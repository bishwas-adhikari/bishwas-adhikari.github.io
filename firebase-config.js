(() => {
  if (!window.firebase) throw new Error('Firebase SDK failed to load.');

  if (!firebase.apps.length) {
    firebase.initializeApp({
      apiKey: 'AIzaSyAbQXGwPzSkv9ROiswNEAdJ-rTDHfACr9k',
      authDomain: 'abhash-7f187.firebaseapp.com',
      projectId: 'abhash-7f187',
      storageBucket: 'abhash-7f187.firebasestorage.app',
      messagingSenderId: '793075358902',
      appId: '1:793075358902:web:79723c2d5b4aea75199a17',
      measurementId: 'G-1P0R3ZFG5J'
    });
  }

  const local = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  if (local && window.location.port === '5000') {
    firebase.auth().useEmulator('http://127.0.0.1:9099');
    firebase.firestore().useEmulator('127.0.0.1', 8080);
    firebase.storage().useEmulator('127.0.0.1', 9199);
  }
})();
