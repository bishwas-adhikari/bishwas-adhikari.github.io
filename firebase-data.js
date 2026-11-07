window.FSNFirebase = (() => {
  const db = firebase.firestore();
  const auth = firebase.auth();
  const storage = firebase.storage();
  const TYPES = ['update', 'highlight', 'article', 'news', 'opportunity', 'video', 'resource'];
  const today = () => new Date().toISOString().slice(0, 10);
  const cleanText = (value, max) => String(value ?? '').trim().slice(0, max);

  function cleanItem(item) {
    return {
      type: TYPES.includes(item.type) ? item.type : 'article',
      title: cleanText(item.title, 200),
      title_ne: cleanText(item.title_ne, 200),
      summary: cleanText(item.summary, 500),
      body: cleanText(item.body, 20000),
      url: cleanText(item.url, 500),
      fileType: cleanText(item.fileType, 8).toUpperCase(),
      published: item.published !== false,
      date: /^\d{4}-\d{2}-\d{2}$/.test(item.date) ? item.date : today()
    };
  }

  function sortByDate(items) {
    return items.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  }

  async function isAdmin() {
    const user = auth.currentUser;
    if (!user) return false;
    const token = await user.getIdTokenResult(true);
    return token.claims.admin === true;
  }

  async function listItems(type, query = '', limit = 100) {
    let ref = db.collection('items');
    if (type) ref = ref.where('type', '==', type);
    const snapshot = await ref.get();
    let items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(item => item.published);
    const search = cleanText(query, 200).toLowerCase();
    if (search) {
      items = items.filter(item => [item.title, item.title_ne, item.summary, item.body].join(' ').toLowerCase().includes(search));
    }
    return sortByDate(items).slice(0, Math.min(Number(limit) || 100, 200));
  }

  function watchItems(callback, onError) {
    return db.collection('items').onSnapshot(snapshot => {
      const items = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(item => item.published);
      callback(sortByDate(items));
    }, onError || (() => {}));
  }

  async function getItem(id) {
    const doc = await db.collection('items').doc(id).get();
    if (!doc.exists || !doc.data().published) return null;
    return { id: doc.id, ...doc.data() };
  }

  function watchItem(id, callback, onError) {
    return db.collection('items').doc(id).onSnapshot(doc => {
      if (!doc.exists || !doc.data().published) {
        callback(null);
        return;
      }
      callback({ id: doc.id, ...doc.data() });
    }, onError || (() => {}));
  }

  async function listSocial() {
    const doc = await db.collection('settings').doc('socialLinks').get();
    return doc.exists ? (doc.data().links || []) : [];
  }

  function watchSocial(callback, onError) {
    return db.collection('settings').doc('socialLinks').onSnapshot(doc => {
      callback(doc.exists ? (doc.data().links || []) : []);
    }, onError || (() => {}));
  }

  async function submit(data) {
    if (data.website) return { ok: true };
    const submission = {
      type: data.type === 'news' ? 'news' : 'article',
      title: cleanText(data.title, 200),
      body: cleanText(data.body, 20000),
      name: cleanText(data.name, 100),
      email: cleanText(data.email, 120),
      link: cleanText(data.link, 500),
      date: today(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (!submission.title || !submission.body || !submission.name) throw new Error('Name, title and content are required.');
    const ref = await db.collection('submissions').add(submission);
    return { id: ref.id, ok: true };
  }

  async function adminSignIn(email, password) {
    await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
    const credential = await auth.signInWithEmailAndPassword(email, password);
    const token = await credential.user.getIdTokenResult(true);
    if (token.claims.admin !== true) {
      await auth.signOut();
      throw new Error('This account is not an administrator.');
    }
    return { ok: true };
  }

  async function adminSignOut() {
    await auth.signOut();
  }

  async function listAdminItems() {
    const snapshot = await db.collection('items').get();
    return sortByDate(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  }

  async function listSubmissions() {
    const snapshot = await db.collection('submissions').get();
    return sortByDate(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  }

  async function saveItem(id, item) {
    const clean = cleanItem(item);
    if (!clean.title) throw new Error('Title is required.');
    if (id) await db.collection('items').doc(id).set(clean, { merge: true });
    else await db.collection('items').add(clean);
    return clean;
  }

  async function deleteItem(id) {
    await db.collection('items').doc(id).delete();
  }

  async function saveSocialLinks(links) {
    await db.collection('settings').doc('socialLinks').set({ links });
    return links;
  }

  async function approveSubmission(id) {
    const ref = db.collection('submissions').doc(id);
    const doc = await ref.get();
    if (!doc.exists) throw new Error('Not found');
    const submission = doc.data();
    const item = cleanItem({
      type: submission.type,
      title: submission.title,
      summary: String(submission.body || '').slice(0, 500),
      body: String(submission.body || '') + `\n\n— ${submission.name || ''}`,
      url: submission.link || '',
      published: true
    });
    await db.collection('items').add(item);
    await ref.delete();
    return item;
  }

  async function deleteSubmission(id) {
    await db.collection('submissions').doc(id).delete();
  }

  async function uploadFile(file, originalName) {
    if (!(await isAdmin())) throw new Error('Login required');
    const name = String(originalName || file.name || 'file').replace(/[^\w.\- ]/g, '_');
    const extension = name.includes('.') ? '.' + name.split('.').pop().toLowerCase() : '';
    if (!['.pdf', '.doc', '.docx', '.png', '.jpg', '.jpeg', '.webp'].includes(extension)) {
      throw new Error('Allowed: .pdf, .doc, .docx, .png, .jpg, .jpeg, .webp');
    }
    if (file.size > 25 * 1024 * 1024) throw new Error('File is larger than 25 MB.');
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}-${name}`;
    const ref = storage.ref(`uploads/${filename}`);
    await ref.put(file, { contentType: file.type || 'application/octet-stream' });

    const list = await storage.ref('uploads').listAll();
    const withMetadata = await Promise.all(list.items.map(async item => ({ item, metadata: await item.getMetadata() })));
    withMetadata.sort((a, b) => new Date(b.metadata.updated || b.metadata.timeCreated) - new Date(a.metadata.updated || a.metadata.timeCreated));
    await Promise.all(withMetadata.slice(4).map(entry => entry.item.delete().catch(() => null)));

    return { url: await ref.getDownloadURL() };
  }

  return {
    listItems,
    watchItems,
    getItem,
    watchItem,
    listSocial,
    watchSocial,
    submit,
    adminSignIn,
    adminSignOut,
    isAdmin,
    listAdminItems,
    listSubmissions,
    saveItem,
    deleteItem,
    saveSocialLinks,
    approveSubmission,
    deleteSubmission,
    uploadFile
  };
})();
