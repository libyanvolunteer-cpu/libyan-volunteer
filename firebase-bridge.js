// جسر بين الموقع وFirebase. إن فشل التحميل يعمل الموقع بالحفظ المحلي كما كان.
(function () {
  if (window.claude || !window.firebase || !window.FIREBASE_CONFIG) return;
  var app, auth, fs;
  try {
    app = firebase.initializeApp(window.FIREBASE_CONFIG);
    auth = firebase.auth();
    fs = firebase.firestore();
  } catch (e) { return; }

  var ready = new Promise(function (res) {
    var off = auth.onAuthStateChanged(function (u) {
      off();
      if (u) return res(u);
      auth.signInAnonymously().then(function (c) { res(c.user); }, function () { res(null); });
    });
  });
  var cur = function () {
    return ready.then(function (u) {
      if (!u) throw new Error('auth');
      return u;
    });
  };
  var isAdmin = function (u) {
    if (!u || u.isAnonymous || !u.emailVerified || !u.email) return Promise.resolve(false);
    return fs.collection('admins').doc(u.email.toLowerCase()).get().then(
      function (d) { return d.exists; },
      function () { return false; }
    );
  };

  window.claude = {
    use: function (k) {
      if (k === 'db') return cur().then(function () { return fs; });
      if (k === 'user') return cur().then(function (u) {
        return { id: function () { return Promise.resolve(u.uid); }, canEdit: function () { return isAdmin(u); } };
      });
      return Promise.resolve(null);
    }
  };

  // صفحة دخول المشرف: افتح الموقع على الرابط  #/login
  function showLogin() {
    if (document.getElementById('fbl')) return;
    var d = document.createElement('div');
    d.id = 'fbl';
    d.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:50;display:flex;align-items:center;justify-content:center;padding:16px';
    d.innerHTML = '<form style="background:#fff;color:#14201A;padding:20px;border-radius:12px;max-width:340px;width:100%;display:flex;flex-direction:column;gap:10px;font-family:inherit" dir="rtl">' +
      '<h3 style="margin:0">دخول المشرف</h3>' +
      '<input id="fbe" type="email" placeholder="البريد" dir="ltr" autocomplete="username" style="padding:10px;border:1px solid #ccc;border-radius:8px">' +
      '<input id="fbp" type="password" placeholder="كلمة المرور" dir="ltr" autocomplete="current-password" style="padding:10px;border:1px solid #ccc;border-radius:8px">' +
      '<div id="fbm" style="color:#b00020;font-size:14px;min-height:18px"></div>' +
      '<div style="display:flex;gap:8px"><button type="submit" style="flex:1;padding:10px;border:0;border-radius:8px;background:#1a7a45;color:#fff;cursor:pointer">دخول</button>' +
      '<button type="button" id="fbc" style="padding:10px;border:1px solid #ccc;border-radius:8px;background:#fff;cursor:pointer">إغلاق</button></div></form>';
    document.body.appendChild(d);
    var close = function () { d.remove(); if (location.hash === '#/login') location.hash = '#/'; };
    d.querySelector('#fbc').onclick = close;
    d.querySelector('form').onsubmit = function (ev) {
      ev.preventDefault();
      var m = d.querySelector('#fbm');
      m.textContent = '';
      auth.signInWithEmailAndPassword(d.querySelector('#fbe').value.trim(), d.querySelector('#fbp').value).then(function (c) {
        if (!c.user.emailVerified) { m.textContent = 'البريد غير مؤكَّد: استخدم Reset password من Firebase ثم افتح الرابط من بريدك'; return auth.signOut(); }
        return fs.collection('admins').doc(c.user.email.toLowerCase()).get().then(function (d) {
          if (!d.exists) { m.textContent = 'لا يوجد مستند admins باسم: ' + c.user.email.toLowerCase(); return auth.signOut(); }
          return true;
        }, function (e) { m.textContent = 'القواعد ترفض القراءة (' + (e.code || e.message) + '): انشر قواعد Firestore'; return auth.signOut(); }).then(function (ok) {
          if (!ok) return;
          location.hash = '#/admin';
          location.reload();
        });
      }, function (e) { m.textContent = 'فشل الدخول: ' + (e && e.code || ''); });
    };
  }
  function chk() { if (location.hash === '#/login') showLogin(); }
  window.addEventListener('hashchange', chk);
  document.addEventListener('DOMContentLoaded', chk);
  if (document.readyState !== 'loading') chk();
})();
