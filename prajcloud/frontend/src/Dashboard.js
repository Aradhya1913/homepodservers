import React, { useEffect, useState } from 'react';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import dataBanner from './assets/data.jpg';
ChartJS.register(ArcElement, Tooltip, Legend);

const BASE_URL = 'http://localhost:5001';

function Dashboard({ userEmail }) {
  const [files, setFiles] = useState([]);
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPath, setCurrentPath] = useState('');
  const [showActions, setShowActions] = useState(null);
  const [categoryStats, setCategoryStats] = useState({});
  const [totalSize, setTotalSize] = useState(0);
  const [fileTypeFilter, setFileTypeFilter] = useState('all');

  const token = localStorage.getItem('authToken');

  const getFileType = (name) => {
    const ext = name.split('.').pop().toLowerCase();
    if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return 'image';
    if (['mp4', 'mov'].includes(ext)) return 'video';
    if (['pdf', 'doc', 'docx'].includes(ext)) return 'doc';
    if (['zip', 'rar', '7z'].includes(ext)) return 'archive';
    return 'other';
  };

  const getFileIcon = (name) => {
    const ext = name.split('.').pop().toLowerCase();
    if (['pdf'].includes(ext)) return '📄';
    if (['doc', 'docx'].includes(ext)) return '📝';
    if (['zip', 'rar', '7z'].includes(ext)) return '🗜️';
    if (['mp4', 'mov'].includes(ext)) return '🎥';
    return '📦';
  };

  const isImage = (name) => name.match(/\.(jpg|jpeg|png|webp|gif)$/i);

  const fetchFiles = async () => {
    const res = await fetch(`${BASE_URL}/files?folder=${currentPath}`, {
      headers: { Authorization: 'Bearer ' + token }
    });
    const data = await res.json();
    setFiles(data.sort((a, b) => b.isFolder - a.isFolder));

    const total = data.reduce((sum, f) => sum + parseFloat(f.size || 0), 0);
    setTotalSize(total.toFixed(2));

    const stats = { image: 0, video: 0, doc: 0, archive: 0, other: 0 };
    data.forEach((file) => {
      const type = getFileType(file.name);
      stats[type] += parseFloat(file.size || 0);
    });
    setCategoryStats(stats);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setMessage("❌ No file selected.");
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folderPath', currentPath);

    try {
      const res = await fetch(`${BASE_URL}/upload`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token },
        body: formData,
      });
      const text = await res.text();
      setMessage(text);
      setFile(null); // Clear file after upload
      fetchFiles();
    } catch (err) {
      setMessage("❌ Upload failed.");
      console.error(err);
    }
  };

  const handleDelete = async (name) => {
    const fullPath = currentPath ? `${currentPath}/${name}` : name;
    await fetch(`${BASE_URL}/delete/${fullPath}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + token },
    });
    fetchFiles();
  };

  const handleRename = async (oldName) => {
    const newName = prompt('Enter new name:', oldName);
    if (!newName || newName === oldName) return;
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
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setMessage(`⏳ Uploading: ${droppedFile.name}`);
      const formData = new FormData();
      formData.append('file', droppedFile);
      formData.append('folderPath', currentPath);

      try {
        const res = await fetch(`${BASE_URL}/upload`, {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + token },
          body: formData,
        });
        const text = await res.text();
        setMessage(text);
        setFile(null);
        fetchFiles();
      } catch (err) {
        console.error(err);
        setMessage("❌ Upload failed.");
      }
    }
  };

  useEffect(() => {
    fetchFiles();
  }, [currentPath]);

  return (
    <div className="min-h-screen flex bg-[#0a0f1c] text-white font-sans">
      <aside className="w-72 bg-[#121a2f] p-6 flex flex-col shadow-xl overflow-y-auto">
        <button onClick={() => setCurrentPath('')} className="text-2xl font-bold mb-6 hover:text-blue-400">
          🚀 HomePod Servers
        </button>
        <p className="text-sm mb-4">Logged in as:</p>
        <p className="font-semibold text-green-300 break-all">{userEmail}</p>

        <div className="bg-[#1e293b] text-white rounded-lg p-4 mt-8 shadow">
          <h3 className="text-md font-semibold mb-4">📊 Usage Summary</h3>
          <div className="text-2xl font-bold mb-2">{(totalSize / 1024).toFixed(1)} MB</div>
          <Pie
            data={{
              labels: ['Images', 'Videos', 'Documents', 'Archives', 'Others'],
              datasets: [{
                data: Object.values(categoryStats),
                backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#a78bfa']
              }]
            }}
            options={{ plugins: { legend: { display: false } } }}
          />
        </div>
        <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="bg-red-600 hover:bg-red-700 mt-6 py-2 rounded w-full">Logout</button>
      </aside>
      <main className="flex-1 bg-[#111827] text-white p-10 overflow-auto">
        <div className="relative w-full h-80 mb-10">
          <img
            src={dataBanner}
            alt="Banner"
            className="absolute inset-0 w-full h-full object-cover rounded-xl opacity-80"
          />
          <div className="absolute inset-0 bg-black bg-opacity-40 rounded-xl" />
          <div className="relative z-10 flex flex-col justify-center items-center h-full text-center text-white">
            <h2 className="text-4xl font-bold mb-2">Welcome to HomePod Servers</h2>
            <p className="text-lg text-blue-200">Manage your files with style and power</p>
          </div>
        </div>
        <h2 className="text-3xl font-bold mb-6">📁 Your Files</h2>

        {/* Breadcrumbs */}
        {currentPath && (
          <div className="text-sm text-blue-400 mb-4">
            <span className="cursor-pointer" onClick={() => setCurrentPath('')}>Home</span>
            {currentPath.split('/').map((folder, i) => (
              <span key={i}> / <span onClick={() => setCurrentPath(currentPath.split('/').slice(0, i + 1).join('/'))} className="cursor-pointer hover:underline">{folder}</span></span>
            ))}
          </div>
        )}

        {/* Upload Section */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className="mb-6 border-4 border-dashed border-blue-600 bg-gradient-to-br from-[#111827] to-[#1e293b] p-10 rounded-xl shadow-lg hover:shadow-2xl transition text-center"
        >
          <p className="text-lg mb-4 text-blue-300">Drag and drop your file here</p>
          <p className="text-sm text-gray-400 mb-4">or</p>
          <form id="uploadForm" onSubmit={handleUpload} className="flex flex-wrap gap-4 justify-center items-center">
            <label className="bg-blue-600 text-white px-4 py-2 rounded cursor-pointer hover:bg-blue-700 transition">
              📂 Choose File
              <input
                type="file"
                onChange={(e) => setFile(e.target.files[0])}
                className="hidden"
                required
              />
            </label>
            <button
              id="uploadBtn"
              type="submit"
              className="bg-green-600 text-white px-5 py-2 rounded hover:bg-green-700 transition"
            >
              🚀 Upload
            </button>
          </form>
          {file && (
            <p className="text-sm text-green-300 mt-2">
              ✅ Selected: <span className="font-medium">{file.name}</span>
            </p>
          )}
        </div>

        {message && <div className="mb-6 text-blue-400">{message}</div>}

        {/* Search */}
        <input type="text" placeholder="Search files..." className="mb-6 px-4 py-2 border border-gray-500 rounded w-full md:max-w-sm bg-[#0f172a] text-white" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />

        {/* Category Filters */}
        <div className="flex gap-3 mb-6 flex-wrap">
          {[
            { label: 'All', value: 'all', icon: '📁' },
            { label: 'Images', value: 'image', icon: '🖼️' },
            { label: 'Videos', value: 'video', icon: '🎥' },
            { label: 'Docs', value: 'doc', icon: '📄' },
            { label: 'Archives', value: 'archive', icon: '🗜️' },
            { label: 'Others', value: 'other', icon: '📦' }
          ].map(({ label, value, icon }) => (
            <button
              key={value}
              className={`px-3 py-2 rounded text-sm flex items-center gap-1 border transition ${
                fileTypeFilter === value
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-[#1e293b] text-gray-300 border-gray-600'
              }`}
              onClick={() => setFileTypeFilter(value)}
            >
              {icon} {label}
            </button>
          ))}
        </div>

        {/* File Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {files
            .filter(file => file.name.toLowerCase().includes(searchQuery.toLowerCase()) && (fileTypeFilter === 'all' || getFileType(file.name) === fileTypeFilter))
            .map(file => (
              <div
                key={file.name}
                className="relative bg-[#0f172a] p-4 rounded-lg border border-blue-800 shadow-md transition-all duration-300 hover:shadow-2xl hover:scale-105 hover:ring-2 hover:ring-blue-400"
              >
                <div className="absolute top-2 right-2">
                  <button onClick={() => setShowActions(showActions === file.name ? null : file.name)} className="text-lg text-white">⋮</button>
                  {showActions === file.name && (
                    <div className="absolute right-0 mt-2 w-36 bg-white border rounded shadow text-sm text-gray-800 z-50">
                      {!file.isFolder && (
                        <button
                          className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                          onClick={async () => {
                            const fullPath = currentPath ? `${currentPath}/${file.name}` : file.name;
                            try {
                              const res = await fetch(`${BASE_URL}/download/${fullPath}`, {
                                headers: { Authorization: 'Bearer ' + token }
                              });
                              const blob = await res.blob();
                              const url = window.URL.createObjectURL(blob);
                              const link = document.createElement('a');
                              link.href = url;
                              link.setAttribute('download', file.name);
                              document.body.appendChild(link);
                              link.click();
                              link.remove();
                              window.URL.revokeObjectURL(url);
                            } catch (err) {
                              alert('Download failed.');
                              console.error(err);
                            }
                          }}
                        >
                          Download
                        </button>
                      )}
                      <button onClick={() => handleRename(file.name)} className="block w-full px-4 py-2 text-left hover:bg-gray-100">Rename</button>
                      <button onClick={() => handleDelete(file.name)} className="block w-full px-4 py-2 text-left hover:bg-gray-100">Delete</button>
                    </div>
                  )}
                </div>

                <div onClick={() => file.isFolder && setCurrentPath(prev => prev ? `${prev}/${file.name}` : file.name)}>
                  {file.isFolder ? (
                    <div className="w-full h-40 bg-yellow-100 text-6xl flex items-center justify-center rounded mb-2 cursor-pointer">📁</div>
                  ) : isImage(file.name) ? (
                    <img src={`${BASE_URL}/uploads/${currentPath}/${file.name}`} className="w-full h-40 object-cover rounded mb-2 border" alt={file.name} />
                  ) : file.name.match(/\.(mp4|mov)$/i) ? (
                    <video controls className="w-full h-40 object-cover rounded mb-2 border">
                      <source src={`${BASE_URL}/uploads/${currentPath}/${file.name}`} type="video/mp4" />
                      Your browser does not support video.
                    </video>
                  ) : (
                    <div className="w-full h-40 bg-gray-700 text-6xl flex items-center justify-center rounded mb-2">
                      {getFileIcon(file.name)}
                    </div>
                  )}
                  <p className="font-semibold text-white truncate">{file.name}</p>
                  {!file.isFolder && <p className="text-sm text-gray-400">{file.size} KB</p>}
                  <p className="text-sm text-gray-500">{file.time}</p>
                </div>
              </div>
            ))}
        </div>
      </main>
    </div>
  );
}

export default Dashboard;
