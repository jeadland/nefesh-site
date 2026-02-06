// Simple local-only Memories using IndexedDB
const dbName = 'nefesh_memories';
let db;

const albumSelect = document.getElementById('album-select');
const grid = document.getElementById('memories-grid');

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('albums')) {
        const store = db.createObjectStore('albums', { keyPath: 'id', autoIncrement: true });
        store.createIndex('name', 'name', { unique: false });
      }
      if (!db.objectStoreNames.contains('media')) {
        const store = db.createObjectStore('media', { keyPath: 'id', autoIncrement: true });
        store.createIndex('albumId', 'albumId', { unique: false });
      }
    };
    req.onsuccess = () => { db = req.result; resolve(db); };
    req.onerror = () => reject(req.error);
  });
}

async function loadAlbums() {
  const tx = db.transaction('albums', 'readonly');
  const store = tx.objectStore('albums');
  const req = store.getAll();
  return new Promise(resolve => {
    req.onsuccess = () => resolve(req.result || []);
  });
}

async function refreshAlbums() {
  const albums = await loadAlbums();
  albumSelect.innerHTML = '';
  albums.forEach(a => {
    const opt = document.createElement('option');
    opt.value = a.id; opt.textContent = a.name;
    albumSelect.appendChild(opt);
  });
  if (albums.length) {
    albumSelect.value = albums[0].id;
    loadMedia(albums[0].id);
  }
}

async function createAlbum(name) {
  const tx = db.transaction('albums', 'readwrite');
  const store = tx.objectStore('albums');
  store.add({ name });
  return tx.complete;
}

async function addMedia(albumId, files) {
  const tx = db.transaction('media', 'readwrite');
  const store = tx.objectStore('media');
  for (const file of files) {
    const buffer = await file.arrayBuffer();
    store.add({ albumId, name: file.name, type: file.type, data: buffer, caption: '' });
  }
  return tx.complete;
}

async function loadMedia(albumId) {
  grid.innerHTML = '';
  const tx = db.transaction('media', 'readonly');
  const store = tx.objectStore('media');
  const index = store.index('albumId');
  const req = index.getAll(IDBKeyRange.only(Number(albumId)));
  req.onsuccess = () => {
    const items = req.result || [];
    items.forEach(item => {
      const tile = document.createElement('div');
      tile.className = 'tile';
      const blob = new Blob([item.data], { type: item.type });
      const url = URL.createObjectURL(blob);
      if (item.type.startsWith('video')) {
        const v = document.createElement('video');
        v.src = url; v.controls = true;
        tile.appendChild(v);
      } else {
        const img = document.createElement('img');
        img.src = url;
        tile.appendChild(img);
      }
      const cap = document.createElement('div');
      cap.className = 'tile-caption';
      cap.textContent = item.name;
      tile.appendChild(cap);
      grid.appendChild(tile);
    });
  };
}

async function downloadAlbum(albumId) {
  const tx = db.transaction('media', 'readonly');
  const store = tx.objectStore('media');
  const index = store.index('albumId');
  const req = index.getAll(IDBKeyRange.only(Number(albumId)));
  req.onsuccess = async () => {
    const items = req.result || [];
    if (!items.length) return alert('No media in this album');
    const zip = new JSZip();
    items.forEach(item => {
      zip.file(item.name, item.data);
    });
    const blob = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'nefesh-album.zip';
    a.click();
  };
}

document.getElementById('new-album').onclick = async () => {
  const name = prompt('Album name (e.g., Shabbat, Passover):');
  if (!name) return;
  await createAlbum(name);
  refreshAlbums();
};

document.getElementById('add-media').onclick = async () => {
  const albumId = albumSelect.value;
  if (!albumId) return alert('Create an album first');
  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = true;
  input.accept = 'image/*,video/*';
  input.onchange = async () => {
    await addMedia(albumId, input.files);
    loadMedia(albumId);
  };
  input.click();
};

albumSelect.onchange = () => loadMedia(albumSelect.value);

document.getElementById('download-album').onclick = () => downloadAlbum(albumSelect.value);

openDB().then(refreshAlbums);
