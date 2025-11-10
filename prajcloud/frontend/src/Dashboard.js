// Dashboard.jsx
import React, { useEffect, useState, useRef } from 'react';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import dataBanner from './assets/data.jpg'; // keep your banner import
import { useNavigate, useLocation } from 'react-router-dom';
import ChatPopup from "./components/Chatpopup";
ChartJS.register(ArcElement, Tooltip, Legend);

const BASE_URL = "http://localhost:5001";

function humanFileSize(kb) {
  const n = Number(kb);
  if (isNaN(n)) return '';
  if (n < 1024) return `${n.toFixed(0)} KB`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} MB`;
  return `${(n / (1024 * 1024)).toFixed(2)} GB`;
}

export default function Dashboard({ userEmail }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [files, setFiles] = useState([]);
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPath, setCurrentPathRaw] = useState('');
  const [categoryStats, setCategoryStats] = useState({ image: 0, video: 0, doc: 0, archive: 0, other: 0 });
  const [totalSize, setTotalSize] = useState(0); // total size of current folder
  const [rootTotalSize, setRootTotalSize] = useState(0); // total size of root folder (for storage bar)
  const [viewMode, setViewMode] = useState('grid'); // grid | list
  const [openMenu, setOpenMenu] = useState(null); // file/folder menu open
  const [newFolderName, setNewFolderName] = useState('');
  const [backHistory, setBackHistory] = useState([]); // for navigation
  const [forwardHistory, setForwardHistory] = useState([]); // for navigation
  const [aiInsights, setAiInsights] = useState(''); // AI Insights/analytics
  // AI Data for Gemini chatbox
  const [aiData, setAiData] = useState({});
  const token = localStorage.getItem('authToken');
  const uploadInputRef = useRef(null);

  // Custom setter for currentPath to manage history
  const setCurrentPath = (newPathOrUpdater) => {
    setCurrentPathRaw(prev => {
      let newPath = typeof newPathOrUpdater === 'function' ? newPathOrUpdater(prev) : newPathOrUpdater;
      if (newPath !== prev) {
        setBackHistory(hist => [...hist, prev]);
        setForwardHistory([]); // Clear forward history on new navigation
      }
      return newPath;
    });
  };

  // Back navigation
  const handleBack = () => {
    setBackHistory(prevBack => {
      if (prevBack.length === 0) return prevBack;
      setForwardHistory(prevForward => [currentPath, ...prevForward]);
      const last = prevBack[prevBack.length - 1];
      setCurrentPathRaw(last);
      return prevBack.slice(0, -1);
    });
  };

  // Forward navigation
  const handleForward = () => {
    setForwardHistory(prevForward => {
      if (prevForward.length === 0) return prevForward;
      setBackHistory(prevBack => [...prevBack, currentPath]);
      const next = prevForward[0];
      setCurrentPathRaw(next);
      return prevForward.slice(1);
    });
  };

  // utilities
  const extOf = (name) => name.split('.').pop().toLowerCase();
  const getFileType = (name) => {
    const ext = extOf(name);
    if (['jpg','jpeg','png','webp','gif'].includes(ext)) return 'image';
    if (['mp4','mov','webm','mkv'].includes(ext)) return 'video';
    if (['pdf','doc','docx','txt','xls','xlsx','ppt','pptx'].includes(ext)) return 'doc';
    if (['zip','rar','7z','tar','gz'].includes(ext)) return 'archive';
    return 'other';
  };
  const isImage = (name) => /\.(jpg|jpeg|png|webp|gif)$/i.test(name);
  const isVideo = (name) => /\.(mp4|mov|webm|mkv)$/i.test(name);
  const uploadPathFor = (name) => `${BASE_URL}/uploads/${currentPath ? encodeURIComponent(currentPath) + '/' : ''}${encodeURIComponent(name)}`;

  // fetch files and also fetch root total size for storage bar
  const fetchFiles = async () => {
    try {
      // Fetch files for current folder
      const res = await fetch(`${BASE_URL}/files?folder=${encodeURIComponent(currentPath)}`, {
        headers: { Authorization: 'Bearer ' + token }
      });
      if (!res.ok) {
        const txt = await res.text();
        setMessage(txt || 'Failed to fetch files.');
        return;
      }
      const data = await res.json();

      // ensure sort: folders first
      data.sort((a, b) => (b.isFolder - a.isFolder) || a.name.localeCompare(b.name));
      setFiles(data);

      // totals for current folder
      const total = data.reduce((sum, f) => sum + (parseFloat(f.size) || 0), 0);
      setTotalSize(total);

      // category stats
      const stats = { image: 0, video: 0, doc: 0, archive: 0, other: 0 };
      let fileCount = 0;
      let folderCount = 0;
      let largestFile = null;
      let largestFileSize = 0;
      let fileTypes = {};
      data.forEach((f) => {
        if (f.isFolder) {
          folderCount++;
        } else {
          fileCount++;
          const t = getFileType(f.name);
          stats[t] += parseFloat(f.size || 0);
          fileTypes[t] = (fileTypes[t] || 0) + 1;
          if ((parseFloat(f.size) || 0) > largestFileSize) {
            largestFile = f.name;
            largestFileSize = parseFloat(f.size) || 0;
          }
        }
      });
      setCategoryStats(stats);
      setMessage('');

      // Fetch total size of root folder for storage bar if not already at root, else set to total
      let rootTotal = total;
      if (currentPath === '') {
        setRootTotalSize(total);
      } else {
        // fetch files at root to compute root total size
        const rootRes = await fetch(`${BASE_URL}/files?folder=`, {
          headers: { Authorization: 'Bearer ' + token }
        });
        if (rootRes.ok) {
          const rootData = await rootRes.json();
          rootTotal = rootData.reduce((sum, f) => sum + (parseFloat(f.size) || 0), 0);
          setRootTotalSize(rootTotal);
        }
      }

      // ✅ Enhanced aiData with full live analytics for Gemini
      setAiData({
        folder: currentPath || "root",
        totalFiles: fileCount + folderCount,
        fileCount,
        folderCount,
        totalSize: total,
        totalSizeHuman: humanFileSize(total),
        rootTotalSize: rootTotal,
        rootTotalSizeHuman: humanFileSize(rootTotal),
        images: fileTypes.image || 0,
        videos: fileTypes.video || 0,
        pdfs: fileTypes.doc || 0,
        docs: fileTypes.doc || 0,
        others: fileTypes.other || 0,
        categoryStats: { ...stats },
        fileTypes: { ...fileTypes },
        largestFile,
        largestFileSize,
        largestFileSizeHuman: humanFileSize(largestFileSize),
        allFiles: data.filter(f => !f.isFolder).map(f => ({
          name: f.name,
          size: f.size,
          type: getFileType(f.name)
        })),
        allFolders: data.filter(f => f.isFolder).map(f => ({ name: f.name })),
        lastUpdated: new Date().toISOString()
      });
    } catch (err) {
      console.error(err);
      setMessage('Network error while fetching files.');
    }
  };

// Fetch AI insights/analytics from backend
const fetchAIInsights = async () => {
  try {
    // Ensure only the folder path is sent, not the full /app/... route
    const folderPath = currentPath.replace(/^app\//, '').replace(/^\/app\//, '');
    const res = await fetch(`${BASE_URL}/analytics?folder=${encodeURIComponent(folderPath)}`, {
      headers: { Authorization: 'Bearer ' + token }
    });
    if (res.ok) {
      const data = await res.json();
      setAiInsights(data.summary);
      // Optionally, merge backend analytics into aiData if needed
setAiData(prev => ({
  ...prev,
  globalStats: {
    totalFiles: data.stats?.totalFiles || 0,
    totalFolders: data.stats?.totalFolders || 0,
    totalSize: data.stats?.totalSize ? (data.stats.totalSize / (1024 * 1024)).toFixed(2) + " MB" : "0 MB",
    images: data.stats?.imageCount || 0,
    pdfs: data.stats?.pdfCount || 0,
    videos: data.stats?.videoCount || 0,
    docs: data.stats?.docCount || 0,
    others: data.stats?.otherCount || 0
  }
}));
    }
  } catch (err) {
    console.error('Failed to load analytics', err);
  }
};

  useEffect(() => { fetchFiles(); }, [currentPath]);
  useEffect(() => {
    let urlPath = decodeURIComponent(location.pathname);
    if (urlPath === '/app' || urlPath === '/app/') {
      setCurrentPathRaw('');
    } else {
      // Clean extra /app/ or encoded slashes
      urlPath = urlPath.replace(/^\/app\//, '').replace(/^app\//, '').replace(/^%2Fapp%2F/, '');
      if (urlPath !== currentPath) {
        setCurrentPathRaw(urlPath);
      }
    }
  }, [location.pathname]);
  useEffect(() => { fetchAIInsights(); }, [currentPath, files]);

  // upload via form
  const handleUploadSubmit = async (e) => {
    e?.preventDefault();
    if (!file) {
      setMessage('❌ Select a file first.');
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folderPath', currentPath);

    try {
      const res = await fetch(`${BASE_URL}/upload`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token },
        body: formData
      });
      const text = await res.text();
      setMessage(text);
      setFile(null);
      if (uploadInputRef.current) uploadInputRef.current.value = ''; // clear input UI
      fetchFiles();
    } catch (err) {
      console.error(err);
      setMessage('❌ Upload failed.');
    }
  };

  // drag & drop
  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const dropped = e.dataTransfer.files?.[0];
    if (!dropped) return;
    setMessage(`⏳ Uploading ${dropped.name}...`);
    const formData = new FormData();
    formData.append('file', dropped);
    formData.append('folderPath', currentPath);

    try {
      const res = await fetch(`${BASE_URL}/upload`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token },
        body: formData
      });
      setMessage(await res.text());
      fetchFiles();
    } catch (err) {
      console.error(err);
      setMessage('❌ Upload failed.');
    }
  };

  // delete
  const handleDelete = async (name) => {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      const fullPath = currentPath ? `${currentPath}/${name}` : name;
      const res = await fetch(`${BASE_URL}/delete/${encodeURIComponent(fullPath)}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + token }
      });
      const text = await res.text();
      setMessage(text);
      fetchFiles();
    } catch (err) {
      console.error(err);
      setMessage('Delete failed.');
    }
  };

  // rename
  const handleRename = async (oldName) => {
    const newName = window.prompt('Enter new name for:', oldName);
    if (!newName || newName === oldName) return;
    try {
      const oldPath = currentPath ? `${currentPath}/${oldName}` : oldName;
      const newPath = currentPath ? `${currentPath}/${newName}` : newName;
      const res = await fetch(`${BASE_URL}/rename`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ oldPath, newPath })
      });
      const text = await res.text();
      setMessage(text);
      fetchFiles();
    } catch (err) {
      console.error(err);
      setMessage('Rename failed.');
    }
  };

  // download
  const handleDownload = async (name) => {
    try {
      const fullPath = currentPath ? `${currentPath}/${name}` : name;
      const res = await fetch(`${BASE_URL}/download/${encodeURIComponent(fullPath)}`, {
        headers: { Authorization: 'Bearer ' + token }
      });
      if (!res.ok) {
        const txt = await res.text();
        setMessage(txt || 'Download failed.');
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setMessage('Download failed.');
    }
  };

  // create folder (best-effort; backend should support /create-folder)
  const handleCreateFolder = async () => {
    let name = newFolderName.trim();
    if (!name) {
      name = window.prompt('New folder name:');
      if (!name) return;
    }
    try {
      const body = { folderPath: currentPath, folderName: name };
      const res = await fetch(`${BASE_URL}/create-folder`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      const text = await res.text();
      setMessage(text);
      setNewFolderName('');
      fetchFiles();
    } catch (err) {
      console.error(err);
      setMessage('Create folder failed (endpoint /create-folder may be missing).');
    }
  };

  // helper to navigate breadcrumbs
  const breadcrumbs = currentPath ? currentPath.split('/') : [];

  // filtered files for UI
  const visibleFiles = files.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Top bar */}
      <header className="h-16 border-b border-gray-200 flex items-center px-6 justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-green-400 rounded-md flex items-center justify-center text-white font-bold">
              {/* Drive logo simplified */}
              <span style={{ fontSize: 14 }}>☁️</span>
            </div>
            <h1 className="text-lg font-semibold">Drive</h1>
          </div>

          {/* search bar */}
          <div className="ml-6 w-[640px]">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search in Drive"
              className="w-full rounded-full border border-gray-200 px-5 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
        </div>

        {/* User profile dropdown */}
        <UserProfileDropdown userEmail={userEmail} />
      </header>

      {/* Navigation bar: Back/Forward */}
      <div className="flex items-center gap-2 px-8 pt-3 pb-1">
        <button
          onClick={handleBack}
          disabled={backHistory.length === 0}
          className={`w-8 h-8 flex items-center justify-center rounded-full border border-gray-200 text-lg mr-1 transition-all duration-200 ${backHistory.length === 0 ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'hover:bg-blue-50 hover:shadow-lg hover:border-blue-300 text-gray-600'}`}
          aria-label="Back"
        >
          ◀
        </button>
        <button
          onClick={handleForward}
          disabled={forwardHistory.length === 0}
          className={`w-8 h-8 flex items-center justify-center rounded-full border border-gray-200 text-lg transition-all duration-200 ${forwardHistory.length === 0 ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'hover:bg-blue-50 hover:shadow-lg hover:border-blue-300 text-gray-600'}`}
          aria-label="Forward"
        >
          ▶
        </button>
        {/* Breadcrumbs inline for context */}
        {currentPath && (
          <div className="ml-3 text-sm text-gray-600 flex items-center">
            <button onClick={() => setCurrentPath('')} className="hover:underline">Home</button>
            {breadcrumbs.map((part, idx) => {
              const upTo = breadcrumbs.slice(0, idx + 1).join('/');
              return (<span key={idx}> / <button onClick={() => setCurrentPath(upTo)} className="hover:underline">{part}</button></span>);
            })}
          </div>
        )}
      </div>

      <div className="flex">
        {/* Left sidebar */}
        <aside className="w-64 border-r border-gray-100 p-6">
          {/* AI Insights section */}
          {aiInsights && (
            <div className="mb-6 text-sm text-gray-700 bg-blue-50 p-3 rounded-md border border-blue-100 shadow-sm">
              <strong>AI Insights:</strong> {aiInsights}
            </div>
          )}
          <div className="mb-6">
            <button
              onClick={() => {/* toggle new menu by simple prompt-based options */ const choice = window.prompt('Type "upload" to upload or "folder" to create folder:'); if (!choice) return; if (choice.toLowerCase().startsWith('u')) uploadInputRef.current?.click(); else handleCreateFolder();}}
              className="w-full text-left bg-white shadow-sm border border-gray-200 rounded-md px-3 py-2 hover:shadow-md"
            >
              <span className="text-lg mr-2">+</span> New
            </button>
            {/* hidden file input used by New -> Upload */}
            <input
              ref={uploadInputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  setFile(e.target.files[0]);
                  // auto-submit
                  const f = e.target.files[0];
                  const formData = new FormData();
                  formData.append('file', f);
                  formData.append('folderPath', currentPath);
                  setMessage(`⏳ Uploading ${f.name}...`);
                  fetch(`${BASE_URL}/upload`, {
                    method: 'POST',
                    headers: { Authorization: 'Bearer ' + token },
                    body: formData
                  }).then(r => r.text()).then(t => { setMessage(t); fetchFiles(); }).catch(err => { console.error(err); setMessage('Upload failed.'); });
                }
              }}
            />
          </div>

          <nav className="flex flex-col gap-2 text-sm">
            <button
              onClick={() => setCurrentPath('')}
              className={`py-2 px-3 rounded-md text-left transition-all duration-200 ${currentPath === '' ? 'bg-blue-50 text-blue-600' : 'hover:bg-blue-50 hover:shadow-lg hover:border-blue-300'}`}
            >
              Home
            </button>
            <button className="py-2 px-3 rounded-md text-left transition-all duration-200 hover:bg-blue-50 hover:shadow-lg hover:border-blue-300">My Drive</button>
            <button className="py-2 px-3 rounded-md text-left transition-all duration-200 hover:bg-blue-50 hover:shadow-lg hover:border-blue-300">Shared with me</button>
            <button className="py-2 px-3 rounded-md text-left transition-all duration-200 hover:bg-blue-50 hover:shadow-lg hover:border-blue-300">Recent</button>
            <button className="py-2 px-3 rounded-md text-left transition-all duration-200 hover:bg-blue-50 hover:shadow-lg hover:border-blue-300">Starred</button>
          </nav>

          <div className="mt-8 text-sm text-gray-600">
            <div className="mb-2">Storage</div>
            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden mb-2">
              <div
                style={{
                  width: rootTotalSize > 0
                    ? `${Math.min(100, (totalSize / rootTotalSize) * 100)}%`
                    : '100%',
                  transition: 'width 0.7s cubic-bezier(0.44, 0.13, 0.48, 0.87)'
                }}
                className="h-2 bg-blue-400"
              />
            </div>
            <div className="flex justify-between text-xs mt-1 text-gray-500">
              <span>
                {currentPath === ''
                  ? humanFileSize(rootTotalSize)
                  : `${humanFileSize(totalSize)} / ${humanFileSize(rootTotalSize)}`}
              </span>
              <span>of {humanFileSize(rootTotalSize)} used</span>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 p-8">
          {/* Banner / suggested */}
          <div className="rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-8">
            <div className="relative h-36 bg-gray-50 flex items-center justify-center">
              <img src={dataBanner} alt="banner" className="absolute inset-0 w-full h-full object-cover opacity-60" />
              <div className="relative z-10 text-center">
                <h2 className="text-2xl font-semibold">Welcome to Your Homepod</h2>
                <p className="text-sm">Manage your files with ease</p>
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 bg-white">
              {/* quick filters */}
              <div className="flex items-center gap-3">
                <button className="px-3 py-1 rounded-full bg-gray-100 text-sm transition-all duration-200 hover:bg-blue-50 hover:shadow-lg hover:border-blue-300">Type</button>
                <button className="px-3 py-1 rounded-full bg-gray-100 text-sm transition-all duration-200 hover:bg-blue-50 hover:shadow-lg hover:border-blue-300">People</button>
                <button className="px-3 py-1 rounded-full bg-gray-100 text-sm transition-all duration-200 hover:bg-blue-50 hover:shadow-lg hover:border-blue-300">Modified</button>
                <button className="px-3 py-1 rounded-full bg-gray-100 text-sm transition-all duration-200 hover:bg-blue-50 hover:shadow-lg hover:border-blue-300">Location</button>

                <div className="ml-auto flex items-center gap-2">
                  <button className="px-2 py-1 border rounded text-sm transition-all duration-200 hover:bg-blue-50 hover:shadow-lg hover:border-blue-300" onClick={() => setViewMode('list')}>☰</button>
                  <button className="px-2 py-1 border rounded text-sm transition-all duration-200 hover:bg-blue-50 hover:shadow-lg hover:border-blue-300" onClick={() => setViewMode('grid')}>▦</button>
                </div>
              </div>
            </div>
          </div>

          {/* Breadcrumbs are now shown above with nav bar */}

          {/* Messages */}
          {message && <div className="mb-4 text-sm text-blue-600">{message}</div>}

          {/* Upload drag area */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); }}
            className="mb-6 border-2 border-dashed border-gray-200 rounded-lg p-6 text-center bg-white"
          >
            <div className="text-sm text-gray-600">Drag files here to upload, or</div>
            <form onSubmit={handleUploadSubmit} className="mt-3 flex items-center justify-center gap-3">
              <label className="px-4 py-2 bg-blue-600 text-white rounded-md cursor-pointer transition-all duration-200 hover:bg-blue-700 hover:shadow-lg hover:border-blue-300">
                Upload
                <input
                  type="file"
                  onChange={(e) => setFile(e.target.files?.[0])}
                  className="hidden"
                />
              </label>
              <button
                type="submit"
                className="px-4 py-2 bg-gray-100 rounded-md transition-all duration-200 hover:bg-blue-50 hover:shadow-lg hover:border-blue-300"
              >
                Confirm
              </button>
            </form>
            {file && <div className="mt-2 text-sm text-gray-700">Selected: <strong>{file.name}</strong></div>}
          </div>

          {/* Files grid or list */}
          {viewMode === 'grid' ? (
            <div>
              {/* Lightweight navigation bar above Suggested files */}
              <div className="flex items-center gap-2 mb-2">
                <button
                  onClick={handleBack}
                  disabled={backHistory.length === 0}
                  className={`w-7 h-7 flex items-center justify-center rounded-full border border-gray-200 text-base mr-1 transition-all duration-200 ${backHistory.length === 0 ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'hover:bg-blue-50 hover:shadow-lg hover:border-blue-300 text-gray-600'}`}
                  aria-label="Back"
                >
                  ◀
                </button>
                <button
                  onClick={handleForward}
                  disabled={forwardHistory.length === 0}
                  className={`w-7 h-7 flex items-center justify-center rounded-full border border-gray-200 text-base transition-all duration-200 ${forwardHistory.length === 0 ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'hover:bg-blue-50 hover:shadow-lg hover:border-blue-300 text-gray-600'}`}
                  aria-label="Forward"
                >
                  ▶
                </button>
              </div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">Suggested files</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {visibleFiles.map((f) => (
                  <div
                    key={f.name}
                    className={
                      "bg-white border border-gray-100 rounded-lg shadow-sm relative cursor-pointer hover:bg-blue-50 hover:shadow-lg hover:border-blue-300 transition-all duration-200"
                    }
                    onClick={e => {
                      // Prevent click when clicking the 3-dot menu button or its menu
                      // (stop propagation in menu button below)
         if (f.isFolder) {
  const newPath = currentPath ? `${currentPath}/${f.name}` : f.name;
  setCurrentPathRaw(newPath);

  // ✅ Update URL dynamically
  navigate(`/app/${encodeURIComponent(newPath)}`, { replace: false });
} else {
                        // For files, select or preview logic (could set a preview modal, etc.)
                        // Here, just show a message for demonstration
                        setMessage(`Selected: ${f.name}`);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={f.isFolder ? `Open folder ${f.name}` : `Preview file ${f.name}`}
                  >
                    <div className="p-3">
                      {/* preview / folder */}
                      <div className="w-full h-36 bg-gray-50 rounded-md mb-3 flex items-center justify-center overflow-hidden">
                        {f.isFolder ? (
                          <div className="text-5xl">📁</div>
                        ) : isImage(f.name) ? (
                          <img src={uploadPathFor(f.name)} alt={f.name} className="w-full h-full object-cover" />
                        ) : isVideo(f.name) ? (
                          <video src={uploadPathFor(f.name)} className="w-full h-full object-cover" />
                        ) : (
                          <div className="text-4xl">📄</div>
                        )}
                      </div>

                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="font-medium truncate" title={f.name}>
                            {f.name}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">{f.isFolder ? 'Folder' : humanFileSize(f.size)}</div>
                        </div>

                        {/* three dot menu */}
                        <div className="relative z-20">
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              setOpenMenu(openMenu === f.name ? null : f.name);
                            }}
                            className="px-2 py-1 rounded transition-all duration-200 hover:bg-blue-50 hover:shadow-lg hover:border-blue-300"
                            tabIndex={0}
                            aria-label="Open file/folder actions"
                          >
                            ⋮
                          </button>

                          {openMenu === f.name && (
                            <div className="absolute right-0 mt-2 w-40 bg-white border rounded shadow z-40">
                              {!f.isFolder && (
                                <button
                                  onClick={() => { handleDownload(f.name); setOpenMenu(null); }}
                                  className="w-full text-left px-4 py-2 transition-all duration-200 hover:bg-blue-50 hover:shadow-lg hover:border-blue-300"
                                >Download</button>
                              )}
                              <button
                                onClick={() => { handleRename(f.name); setOpenMenu(null); }}
                                className="w-full text-left px-4 py-2 transition-all duration-200 hover:bg-blue-50 hover:shadow-lg hover:border-blue-300"
                              >Rename</button>
                              <button
                                onClick={() => { handleDelete(f.name); setOpenMenu(null); }}
                                className="w-full text-left px-4 py-2 transition-all duration-200 hover:bg-blue-50 hover:shadow-lg hover:border-blue-300"
                              >Delete</button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            // list view
            <div className="bg-white border border-gray-100 rounded-md">
              <table className="w-full table-auto">
                <thead className="text-xs text-gray-500 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3">Name</th>
                    <th className="text-left px-4 py-3">Size</th>
                    <th className="text-left px-4 py-3">Modified</th>
                    <th className="text-left px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleFiles.map(f => (
                    <tr
                      key={f.name}
                      className="border-b last:border-b-0 hover:bg-blue-50 hover:shadow-lg hover:border-blue-300 transition-all duration-200 cursor-pointer"
                      onClick={e => {
                        // Prevent navigation/preview if clicking the menu button
                        // (stopPropagation in menu button below)
                        if (f.isFolder) {
                          setCurrentPath(prev => prev ? `${prev}/${f.name}` : f.name);
                        } else {
                          setMessage(`Selected: ${f.name}`);
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      aria-label={f.isFolder ? `Open folder ${f.name}` : `Preview file ${f.name}`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-50 rounded-md flex items-center justify-center">
                            {f.isFolder ? '📁' : getFileType(f.name) === 'image' ? '🖼️' : '📄'}
                          </div>
                          <div className="font-medium">{f.name}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3">{f.isFolder ? '-' : humanFileSize(f.size)}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{f.time || '-'}</td>
                      <td className="px-4 py-3">
                        <div className="relative inline-block z-20">
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              setOpenMenu(openMenu === f.name ? null : f.name);
                            }}
                            className="px-2 py-1 rounded transition-all duration-200 hover:bg-blue-50 hover:shadow-lg hover:border-blue-300"
                            tabIndex={0}
                            aria-label="Open file/folder actions"
                          >⋮</button>
                          {openMenu === f.name && (
                            <div className="absolute right-0 mt-2 w-40 bg-white border rounded shadow z-40">
                              {!f.isFolder && (
                                <button
                                  onClick={() => { handleDownload(f.name); setOpenMenu(null); }}
                                  className="w-full text-left px-4 py-2 transition-all duration-200 hover:bg-blue-50 hover:shadow-lg hover:border-blue-300"
                                >Download</button>
                              )}
                              <button
                                onClick={() => { handleRename(f.name); setOpenMenu(null); }}
                                className="w-full text-left px-4 py-2 transition-all duration-200 hover:bg-blue-50 hover:shadow-lg hover:border-blue-300"
                              >Rename</button>
                              <button
                                onClick={() => { handleDelete(f.name); setOpenMenu(null); }}
                                className="w-full text-left px-4 py-2 transition-all duration-200 hover:bg-blue-50 hover:shadow-lg hover:border-blue-300"
                              >Delete</button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>
      <ChatPopup aiData={aiData} />
    </div>
  );
}
// UserProfileDropdown component
function UserProfileDropdown({ userEmail }) {
  const [open, setOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileImage, setProfileImage] = useState('');
  const [editName, setEditName] = useState('');
  const [editImage, setEditImage] = useState('');
  const dropdownRef = useRef(null);

  // Load profile from localStorage on mount
  useEffect(() => {
    const storedName = localStorage.getItem('profileName');
    const storedImage = localStorage.getItem('profileImage');
    if (storedName) setProfileName(storedName);
    if (storedImage) setProfileImage(storedImage);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const planName = "Free Plan";

  // Handlers for modal
  const handleEditProfile = () => {
    setEditName(profileName || '');
    setEditImage(profileImage || '');
    setShowModal(true);
    setOpen(false);
  };
  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(evt) {
      setEditImage(evt.target.result);
    };
    reader.readAsDataURL(file);
  };
  const handleSaveProfile = (e) => {
    e.preventDefault();
    setProfileName(editName);
    setProfileImage(editImage);
    localStorage.setItem('profileName', editName);
    localStorage.setItem('profileImage', editImage);
    setShowModal(false);
  };

  // Helper for avatar display
  const avatar = profileImage
    ? <img src={profileImage} alt="avatar" className="object-cover w-full h-full rounded-full" />
    : <span style={{ fontSize: 22 }}>{(profileName?.[0] || 'U').toUpperCase()}</span>;
  const dropdownAvatar = profileImage
    ? <img src={profileImage} alt="avatar" className="object-cover w-full h-full rounded-full" />
    : <span style={{ fontSize: 28 }}>{(profileName?.[0] || 'U').toUpperCase()}</span>;

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-xl font-semibold text-gray-700 hover:shadow-md transition-all duration-200 focus:outline-none"
          onClick={() => setOpen((v) => !v)}
          aria-label="Open user menu"
          tabIndex={0}
        >
          {avatar}
        </button>
        {open && (
          <div
            className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-4 px-5 animate-fade-in"
            style={{ minWidth: '220px' }}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-2xl font-semibold text-gray-700 overflow-hidden">
                {dropdownAvatar}
              </div>
              <div>
                <div className="font-semibold text-base text-gray-900">{profileName || "User Name"}</div>
                <div className="text-xs text-gray-500">{userEmail}</div>
              </div>
            </div>
            <div className="my-2 border-b border-gray-100"></div>
            <div className="mb-3">
              <div className="text-xs text-gray-500 mb-1">Plan</div>
              <div className="px-2 py-1 rounded bg-gray-100 text-xs font-medium inline-block">{planName}</div>
            </div>
            <button
              className="w-full text-left px-4 py-2 rounded-md text-sm font-medium text-gray-700 bg-gray-50 hover:bg-blue-50 transition-all duration-200 mb-2"
              onClick={handleEditProfile}
              tabIndex={0}
            >
              Edit Profile
            </button>
            <button
              className="w-full text-left px-4 py-2 rounded-md text-sm font-medium text-red-600 bg-gray-50 hover:bg-red-50 hover:text-red-700 transition-all duration-200"
              onClick={() => {
                // Clear all user-related data from localStorage on logout
                localStorage.removeItem('authToken');
                localStorage.removeItem('userEmail');
                localStorage.removeItem('userName');
                localStorage.removeItem('profileImage');
                localStorage.removeItem('profileName');
                window.location.href = '/app';
              }}
              tabIndex={0}
            >
              Logout
            </button>
          </div>
        )}
      </div>
      {/* Edit Profile Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-xs relative">
            <button
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 text-xl"
              onClick={() => setShowModal(false)}
              aria-label="Close modal"
            >&times;</button>
            <h2 className="text-lg font-semibold mb-4 text-center">Edit Profile</h2>
            <form onSubmit={handleSaveProfile} className="flex flex-col items-center gap-4">
              <label className="cursor-pointer">
                <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden mb-2 border-2 border-gray-300">
                  {editImage
                    ? <img src={editImage} alt="avatar" className="object-cover w-full h-full rounded-full" />
                    : <span style={{ fontSize: 36 }}>{(editName?.[0] || profileName?.[0] || 'U').toUpperCase()}</span>
                  }
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageChange}
                />
                <div className="text-xs text-blue-600 hover:underline text-center">Change Picture</div>
              </label>
              <input
                type="text"
                className="w-full border border-gray-200 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200 text-center"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                placeholder="Your Name"
                maxLength={32}
                required
              />
              <button
                type="submit"
                className="w-full mt-2 bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700 transition-all duration-200"
              >
                Save
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}