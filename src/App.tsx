import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Folder, 
  FolderOpen, 
  FileText, 
  BookOpen, 
  Keyboard as KeyboardIcon, 
  RotateCcw, 
  Play, 
  X, 
  Terminal as TerminalIcon,
  ZoomIn,
  ZoomOut
} from 'lucide-react';

interface FSNode {
  type: 'dir' | 'file';
  name: string;
  content?: string;
  children?: Record<string, FSNode>;
}

interface LogEntry {
  id: string;
  text: string;
  type: 'normal' | 'command' | 'error' | 'system' | 'info';
  path?: string;
}

type ViewMode = 'split' | 'visualizer' | 'terminal';

const INITIAL_FS: FSNode = {
  type: 'dir',
  name: '/',
  children: {
    etc: {
      type: 'dir',
      name: 'etc',
      children: {
        netplan: {
          type: 'dir',
          name: 'netplan',
          children: {
            '01-netcfg.yaml': {
              type: 'file',
              name: '01-netcfg.yaml',
              content: `# Konfigurasi Kartu Jaringan Ubuntu Server 22.04 LTS
network:
  version: 2
  renderer: networkd
  ethernets:
    enp0s3:
      dhcp4: no
      addresses:
        - 192.168.1.10/24
      gateway4: 192.168.1.1
      nameservers:
        addresses: [8.8.8.8, 8.8.4.4]
`
            }
          }
        }
      }
    },
    home: {
      type: 'dir',
      name: 'home',
      children: {
        sija: {
          type: 'dir',
          name: 'sija',
          children: {}
        }
      }
    },
    var: {
      type: 'dir',
      name: 'var',
      children: {
        www: {
          type: 'dir',
          name: 'www',
          children: {
            'index.html': {
              type: 'file',
              name: 'index.html',
              content: `<!DOCTYPE html>
<html>
<head>
  <title>SIJA Web Server - Ubuntu 22.04 LTS</title>
</head>
<body style="font-family: sans-serif; background: #f4f4f4; padding: 40px;">
  <h1>Selamat Datang di Web Server Ubuntu SIJA!</h1>
  <p>Layanan Apache / Nginx berjalan dengan lancar.</p>
</body>
</html>
`
            }
          }
        }
      }
    }
  }
};

const COMMAND_GUIDES = [
  {
    cmd: 'pwd',
    name: 'pwd (Print Working Directory)',
    desc: 'Menampilkan alamat atau jalur (path) direktori tempat posisi Anda berada saat ini secara lengkap.',
    syntax: 'pwd',
    example: '/home/sija',
    quickTry: 'pwd'
  },
  {
    cmd: 'ls',
    name: 'ls (List Segment)',
    desc: 'Menampilkan daftar seluruh berkas (file) dan folder (direktori) yang tersimpan di dalam direktori aktif.',
    syntax: 'ls',
    example: '📁 etc/   📁 home/   📁 var/',
    quickTry: 'ls'
  },
  {
    cmd: 'cd',
    name: 'cd (Change Directory)',
    desc: 'Berpindah dari satu folder ke folder lainnya di dalam struktur sistem berkas Linux.',
    syntax: 'cd <nama_folder>\n• cd .. (naik 1 tingkat)\n• cd / (ke root utama)\n• cd ~ (ke home folder)',
    example: 'cd /etc/netplan',
    quickTry: 'cd /etc/netplan'
  },
  {
    cmd: 'mkdir',
    name: 'mkdir (Make Directory)',
    desc: 'Membuat direktori atau folder baru pada lokasi direktori kerja aktif atau path yang ditentukan.',
    syntax: 'mkdir <nama_folder_baru>',
    example: 'mkdir /home/sija/modul_tkj',
    quickTry: 'mkdir /home/sija/modul_tkj'
  },
  {
    cmd: 'touch',
    name: 'touch (Create File)',
    desc: 'Membuat berkas (file) baru dalam keadaan kosong secara instan tanpa perlu membuka teks editor.',
    syntax: 'touch <nama_file>',
    example: 'touch /home/sija/catatan.txt',
    quickTry: 'touch /home/sija/catatan.txt'
  },
  {
    cmd: 'nano',
    name: 'nano (GNU nano Text Editor)',
    desc: 'Membuka aplikasi penyunting teks di konsol terminal untuk mengedit atau membuat file konfigurasi.',
    syntax: 'nano <nama_file>',
    example: 'nano /etc/netplan/01-netcfg.yaml',
    quickTry: 'nano /etc/netplan/01-netcfg.yaml'
  },
  {
    cmd: 'cat',
    name: 'cat (Concatenate & Display)',
    desc: 'Membaca dan menampilkan seluruh teks isi file langsung ke layar terminal tanpa mode edit.',
    syntax: 'cat <nama_file>',
    example: 'cat /var/www/index.html',
    quickTry: 'cat /var/www/index.html'
  },
  {
    cmd: 'rm',
    name: 'rm (Remove)',
    desc: 'Menghapus file atau folder dari dalam hierarki sistem direktori Ubuntu Server.',
    syntax: 'rm <nama_file_atau_folder>',
    example: 'rm /home/sija/catatan.txt',
    quickTry: 'rm /home/sija/catatan.txt'
  },
  {
    cmd: 'clear',
    name: 'clear (Clear Console)',
    desc: 'Membersihkan riwayat tampilan teks di layar terminal agar rapi kembali.',
    syntax: 'clear',
    example: 'Layar konsol bersih kembali.',
    quickTry: 'clear'
  }
];

export default function App() {
  const [fs, setFs] = useState<FSNode>(() => JSON.parse(JSON.stringify(INITIAL_FS)));
  const [currentPath, setCurrentPath] = useState<string[]>(['home', 'sija']);
  const [logs, setLogs] = useState<LogEntry[]>([
    { id: '1', text: 'Selamat datang di Interactive Ubuntu Server 22.04 LTS Terminal & Visualizer!', type: 'system' },
    { id: '2', text: 'Ketik perintah dasar Linux atau buka menu "Materi & Panduan Perintah" di atas.', type: 'info' }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [showMateri, setShowMateri] = useState(false);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [activeBouncePath, setActiveBouncePath] = useState<string | null>(null);

  // Responsive & View Modes
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [zoomLevel, setZoomLevel] = useState<number>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 640) {
      return 0.85; // Default compact zoom on mobile
    }
    return 1.0;
  });

  // Nano Modal State
  const [nanoState, setNanoState] = useState<{
    isOpen: boolean;
    filePath: string[];
    fileName: string;
    content: string;
    originalContent: string;
    isModified: boolean;
    statusTag: string;
    showConfirmDialog: boolean;
  }>({
    isOpen: false,
    filePath: [],
    fileName: '',
    content: '',
    originalContent: '',
    isModified: false,
    statusTag: '',
    showConfirmDialog: false
  });

  const visualizerRef = useRef<HTMLDivElement>(null);
  const innerZoomWrapperRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const terminalLogsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-detect mobile screen on load
  useEffect(() => {
    const handleWindowResize = () => {
      if (window.innerWidth < 640 && zoomLevel > 0.9) {
        setZoomLevel(0.85);
      }
    };
    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, [zoomLevel]);

  // Helper formatting for path
  const formatPathString = useCallback((pathArray: string[]) => {
    if (pathArray.length === 0) return '/';
    if (pathArray.length === 2 && pathArray[0] === 'home' && pathArray[1] === 'sija') return '~';
    if (pathArray.length > 2 && pathArray[0] === 'home' && pathArray[1] === 'sija') {
      return '~/' + pathArray.slice(2).join('/');
    }
    return '/' + pathArray.join('/');
  }, []);

  // Helper to find node by path
  const getNodeByPath = useCallback((pathArray: string[], rootNode: FSNode = fs): FSNode | null => {
    let current: FSNode | undefined = rootNode;
    for (const part of pathArray) {
      if (current && current.children && current.children[part]) {
        current = current.children[part];
      } else {
        return null;
      }
    }
    return current || null;
  }, [fs]);

  // Resolve relative/absolute path string
  const resolvePath = useCallback((pathStr: string): string[] => {
    if (!pathStr || pathStr.trim() === '' || pathStr === '~') {
      return ['home', 'sija'];
    }

    let targetPath = pathStr.startsWith('/') ? [] : [...currentPath];
    const parts = pathStr.split('/').filter(p => p.length > 0 && p !== '.');

    for (const part of parts) {
      if (part === '..') {
        if (targetPath.length > 0) targetPath.pop();
      } else if (part === '~') {
        targetPath = ['home', 'sija'];
      } else {
        targetPath.push(part);
      }
    }
    return targetPath;
  }, [currentPath]);

  // Parse path and base
  const parsePathAndBase = useCallback((fullPathStr: string) => {
    const clean = fullPathStr.trim();
    const lastSlashIndex = clean.lastIndexOf('/');

    if (lastSlashIndex === -1) {
      return { parentPathArray: [...currentPath], baseName: clean };
    }

    let parentStr = clean.substring(0, lastSlashIndex);
    const baseName = clean.substring(lastSlashIndex + 1);

    if (parentStr === '') parentStr = '/';

    const parentPathArray = resolvePath(parentStr);
    return { parentPathArray, baseName };
  }, [currentPath, resolvePath]);

  // Redraw SVG connecting curves
  const redrawLines = useCallback(() => {
    if (!svgRef.current || !innerZoomWrapperRef.current) return;
    const svg = svgRef.current;
    const innerWrapper = innerZoomWrapperRef.current;

    // Clear existing paths
    svg.innerHTML = '';

    const innerRect = innerWrapper.getBoundingClientRect();
    const zoom = zoomLevel || 1;

    // Set SVG internal user coordinates matching unscaled content
    const unscaledWidth = innerRect.width / zoom;
    const unscaledHeight = innerRect.height / zoom;
    svg.setAttribute('width', `${unscaledWidth}`);
    svg.setAttribute('height', `${unscaledHeight}`);
    svg.setAttribute('viewBox', `0 0 ${unscaledWidth} ${unscaledHeight}`);

    const parentGroups = innerWrapper.querySelectorAll('.tree-node-group');

    parentGroups.forEach(group => {
      const parentCard = group.querySelector(':scope > .node-card');
      const childrenContainer = group.querySelector(':scope > .tree-children');

      if (parentCard && childrenContainer) {
        const childCards = childrenContainer.querySelectorAll(':scope > .tree-node-group > .node-card');
        const parentRect = parentCard.getBoundingClientRect();

        // Calculate unscaled coordinates inside innerWrapper
        const parentX = (parentRect.left + parentRect.width / 2 - innerRect.left) / zoom;
        const parentY = (parentRect.bottom - innerRect.top) / zoom;

        childCards.forEach(childCard => {
          const childRect = childCard.getBoundingClientRect();
          const childX = (childRect.left + childRect.width / 2 - innerRect.left) / zoom;
          const childY = (childRect.top - innerRect.top) / zoom;

          const midY = parentY + (childY - parentY) / 2;
          const pathD = `M ${parentX} ${parentY} C ${parentX} ${midY}, ${childX} ${midY}, ${childX} ${childY}`;

          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          path.setAttribute('d', pathD);
          path.setAttribute('stroke', '#E95420');
          path.setAttribute('stroke-width', '2.5');
          path.setAttribute('fill', 'none');
          path.setAttribute('stroke-dasharray', '5,3');
          path.setAttribute('opacity', '0.85');

          const startDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          startDot.setAttribute('cx', `${parentX}`);
          startDot.setAttribute('cy', `${parentY}`);
          startDot.setAttribute('r', '3.5');
          startDot.setAttribute('fill', '#FFDC00');

          const endDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          endDot.setAttribute('cx', `${childX}`);
          endDot.setAttribute('cy', `${childY}`);
          endDot.setAttribute('r', '3.5');
          endDot.setAttribute('fill', '#00FF66');

          svg.appendChild(path);
          svg.appendChild(startDot);
          svg.appendChild(endDot);
        });
      }
    });
  }, [zoomLevel]);

  // Update SVG lines when FS, Path, Zoom or ViewMode changes
  useEffect(() => {
    const timer = setTimeout(() => {
      redrawLines();
    }, 60);
    return () => clearTimeout(timer);
  }, [fs, currentPath, zoomLevel, viewMode, redrawLines]);

  useEffect(() => {
    const handleResize = () => redrawLines();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [redrawLines]);

  // Scroll logs to bottom
  useEffect(() => {
    if (terminalLogsRef.current) {
      terminalLogsRef.current.scrollTop = terminalLogsRef.current.scrollHeight;
    }
  }, [logs]);

  // Terminal logging
  const addLog = useCallback((text: string, type: LogEntry['type'] = 'normal', path?: string) => {
    setLogs(prev => [...prev, { id: Date.now() + '-' + Math.random(), text, type, path }]);
  }, []);

  // Reset to initial file system
  const handleResetFS = () => {
    setFs(JSON.parse(JSON.stringify(INITIAL_FS)));
    setCurrentPath(['home', 'sija']);
    addLog('Sistem berkas Ubuntu telah direset ke kondisi awal.', 'system');
  };

  // Open Nano Editor
  const openNano = (filePathInput: string) => {
    const { parentPathArray, baseName } = parsePathAndBase(filePathInput);
    const parentNode = getNodeByPath(parentPathArray);

    if (!parentNode || parentNode.type !== 'dir') {
      addLog(`nano: direktori '${filePathInput}' tidak ditemukan`, 'error');
      return;
    }

    let fileNode = parentNode.children?.[baseName];
    if (!fileNode) {
      const updatedFS = JSON.parse(JSON.stringify(fs));
      const targetParent = getNodeByPath(parentPathArray, updatedFS);
      if (targetParent && targetParent.children) {
        targetParent.children[baseName] = { type: 'file', name: baseName, content: '' };
        setFs(updatedFS);
      }
      fileNode = { type: 'file', name: baseName, content: '' };
    }

    const content = fileNode.content || '';
    setNanoState({
      isOpen: true,
      filePath: [...parentPathArray, baseName],
      fileName: baseName,
      content,
      originalContent: content,
      isModified: false,
      statusTag: '',
      showConfirmDialog: false
    });
  };

  // Nano Save Action
  const handleNanoSave = () => {
    const { filePath, fileName, content } = nanoState;
    const parentPathArray = filePath.slice(0, -1);

    const updatedFS = JSON.parse(JSON.stringify(fs));
    const parentNode = getNodeByPath(parentPathArray, updatedFS);
    if (parentNode && parentNode.children && parentNode.children[fileName]) {
      parentNode.children[fileName].content = content;
      setFs(updatedFS);
    }

    setNanoState(prev => ({
      ...prev,
      originalContent: content,
      isModified: false,
      statusTag: '[ Tersimpan / Saved ]'
    }));

    setTimeout(() => {
      setNanoState(prev => ({
        ...prev,
        statusTag: prev.isModified ? '[ Modified ]' : ''
      }));
    }, 1500);
  };

  // Nano Exit Action
  const handleNanoExit = () => {
    if (nanoState.isModified) {
      setNanoState(prev => ({ ...prev, showConfirmDialog: true }));
    } else {
      setNanoState(prev => ({ ...prev, isOpen: false }));
      addLog('Keluar dari GNU nano editor.', 'info');
    }
  };

  const handleNanoConfirmExit = (save: boolean) => {
    if (save) {
      handleNanoSave();
    }
    setNanoState(prev => ({ ...prev, isOpen: false, showConfirmDialog: false }));
    addLog(`Keluar dari GNU nano editor ${save ? '(perubahan disimpan)' : '(perubahan dibuang)'}.`, 'info');
  };

  // Execute terminal commands
  const executeCommand = (cmdText?: string) => {
    const rawInput = (cmdText !== undefined ? cmdText : inputValue).trim();
    if (rawInput === '') return;

    // Add to logs & history
    addLog(rawInput, 'command', formatPathString(currentPath));
    setHistory(prev => [...prev, rawInput]);
    setHistoryIndex(-1);
    setInputValue('');

    const parts = rawInput.split(' ').filter(p => p.length > 0);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (cmd) {
      case 'pwd': {
        addLog(formatPathString(currentPath), 'normal');
        break;
      }
      case 'ls': {
        const activeNode = getNodeByPath(currentPath);
        if (!activeNode || !activeNode.children) {
          addLog('(Direktori kosong)', 'info');
          break;
        }

        const keys = Object.keys(activeNode.children);
        if (keys.length === 0) {
          addLog('(Direktori kosong)', 'info');
        } else {
          const list = keys.map(k => {
            const child = activeNode.children![k];
            return child.type === 'dir' ? `📁 ${k}/` : `📄 ${k}`;
          });
          addLog(list.join('   '), 'normal');
        }

        // Trigger bounce animation
        setActiveBouncePath(currentPath.join('/'));
        setTimeout(() => setActiveBouncePath(null), 700);
        break;
      }
      case 'cd': {
        const targetStr = args[0];
        if (!targetStr || targetStr === '' || targetStr === '~') {
          setCurrentPath(['home', 'sija']);
          break;
        }

        const resolved = resolvePath(targetStr);
        const targetNode = getNodeByPath(resolved);

        if (!targetNode) {
          addLog(`bash: cd: ${targetStr}: No such file or directory`, 'error');
        } else if (targetNode.type !== 'dir') {
          addLog(`bash: cd: ${targetStr}: Not a directory`, 'error');
        } else {
          setCurrentPath(resolved);
        }
        break;
      }
      case 'mkdir': {
        const dirInput = args[0];
        if (!dirInput) {
          addLog('mkdir: missing operand (masukkan nama folder yang ingin dibuat)', 'error');
          break;
        }

        const { parentPathArray, baseName } = parsePathAndBase(dirInput);
        const parentNode = getNodeByPath(parentPathArray);

        if (!parentNode || parentNode.type !== 'dir') {
          addLog(`mkdir: cannot create directory '${dirInput}': No such file or directory`, 'error');
          break;
        }

        if (parentNode.children && parentNode.children[baseName]) {
          addLog(`mkdir: cannot create directory '${baseName}': File exists`, 'error');
          break;
        }

        const updatedFS = JSON.parse(JSON.stringify(fs));
        const targetParent = getNodeByPath(parentPathArray, updatedFS);
        if (targetParent && targetParent.children) {
          targetParent.children[baseName] = { type: 'dir', name: baseName, children: {} };
          setFs(updatedFS);
          addLog(`Direktori '${baseName}' berhasil dibuat pada ${formatPathString(parentPathArray)}.`, 'info');
        }
        break;
      }
      case 'touch': {
        const fileInput = args[0];
        if (!fileInput) {
          addLog('touch: missing file operand (masukkan nama berkas yang ingin dibuat)', 'error');
          break;
        }

        const { parentPathArray, baseName } = parsePathAndBase(fileInput);
        const parentNode = getNodeByPath(parentPathArray);

        if (!parentNode || parentNode.type !== 'dir') {
          addLog(`touch: cannot touch '${fileInput}': No such file or directory`, 'error');
          break;
        }

        const updatedFS = JSON.parse(JSON.stringify(fs));
        const targetParent = getNodeByPath(parentPathArray, updatedFS);
        if (targetParent && targetParent.children) {
          if (!targetParent.children[baseName]) {
            targetParent.children[baseName] = { type: 'file', name: baseName, content: '' };
            addLog(`Berkas '${baseName}' berhasil dibuat.`, 'info');
          } else {
            addLog(`Timestamp berkas '${baseName}' diperbarui.`, 'info');
          }
          setFs(updatedFS);
        }
        break;
      }
      case 'nano': {
        const fileInput = args[0];
        if (!fileInput) {
          addLog('nano: missing file operand (contoh: nano /etc/netplan/01-netcfg.yaml)', 'error');
          break;
        }
        openNano(fileInput);
        break;
      }
      case 'cat': {
        const fileInput = args[0];
        if (!fileInput) {
          addLog('cat: missing file operand (masukkan nama berkas)', 'error');
          break;
        }

        const { parentPathArray, baseName } = parsePathAndBase(fileInput);
        const parentNode = getNodeByPath(parentPathArray);

        if (!parentNode || !parentNode.children || !parentNode.children[baseName]) {
          addLog(`cat: ${fileInput}: No such file or directory`, 'error');
          break;
        }

        const fileNode = parentNode.children[baseName];
        if (fileNode.type === 'dir') {
          addLog(`cat: ${fileInput}: Is a directory`, 'error');
          break;
        }

        addLog(fileNode.content || '(Berkas kosong)', 'normal');
        break;
      }
      case 'rm': {
        const targetInput = args[0];
        if (!targetInput) {
          addLog('rm: missing operand (masukkan nama file atau folder yang ingin dihapus)', 'error');
          break;
        }

        const { parentPathArray, baseName } = parsePathAndBase(targetInput);
        const parentNode = getNodeByPath(parentPathArray);

        if (!parentNode || !parentNode.children || !parentNode.children[baseName]) {
          addLog(`rm: cannot remove '${targetInput}': No such file or directory`, 'error');
          break;
        }

        if (parentPathArray.length === 0 && (baseName === '' || baseName === '/')) {
          addLog('rm: cannot remove root directory', 'error');
          break;
        }

        const updatedFS = JSON.parse(JSON.stringify(fs));
        const targetParent = getNodeByPath(parentPathArray, updatedFS);
        if (targetParent && targetParent.children) {
          delete targetParent.children[baseName];
          setFs(updatedFS);
          addLog(`'${baseName}' berhasil dihapus.`, 'info');

          const fullDeletedPath = [...parentPathArray, baseName];
          if (currentPath.join('/').startsWith(fullDeletedPath.join('/'))) {
            setCurrentPath(['home', 'sija']);
            addLog('Posisi direktori otomatis dikembalikan ke /home/sija', 'info');
          }
        }
        break;
      }
      case 'clear': {
        setLogs([]);
        break;
      }
      case 'help': {
        setShowMateri(true);
        break;
      }
      default: {
        addLog(`bash: ${cmd}: command not found. Ketik 'help' atau buka 'Materi & Panduan Perintah'.`, 'error');
        break;
      }
    }
  };

  // Keyboard navigation & tab completion
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      executeCommand();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0) {
        const nextIdx = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(nextIdx);
        setInputValue(history[nextIdx]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (history.length > 0 && historyIndex !== -1) {
        const nextIdx = historyIndex + 1;
        if (nextIdx < history.length) {
          setHistoryIndex(nextIdx);
          setInputValue(history[nextIdx]);
        } else {
          setHistoryIndex(-1);
          setInputValue('');
        }
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const words = inputValue.split(' ');
      const lastWord = words[words.length - 1];
      const activeNode = getNodeByPath(currentPath);
      if (activeNode && activeNode.children && lastWord) {
        const matches = Object.keys(activeNode.children).filter(name => name.startsWith(lastWord));
        if (matches.length === 1) {
          words[words.length - 1] = matches[0];
          setInputValue(words.join(' '));
        }
      }
    }
  };

  // Render tree node component recursively
  const renderTreeNodeGroup = (node: FSNode, pathArr: string[]) => {
    const isCurrentActive = node.type === 'dir' && (pathArr.join('/') === currentPath.join('/'));
    const isBouncing = activeBouncePath === pathArr.join('/');
    const nodePathStr = formatPathString(pathArr);

    return (
      <div key={pathArr.join('-') || 'root'} className="tree-node-group flex flex-col items-center mx-1.5 sm:mx-3 md:mx-4 relative">
        <div
          onClick={(e) => {
            e.stopPropagation();
            if (node.type === 'dir') {
              setCurrentPath([...pathArr]);
              addLog(`Pindah ke direktori: ${nodePathStr}`, 'info');
            } else {
              openNano(nodePathStr);
            }
          }}
          className={`node-card group flex items-center gap-1.5 sm:gap-2.5 px-2.5 sm:px-4 md:px-5 py-2 sm:py-2.5 md:py-3 rounded-lg sm:rounded-xl cursor-pointer shadow-lg transition-all duration-200 select-none min-w-[95px] sm:min-w-[120px] md:min-w-[135px] justify-center relative z-10 border-2 ${
            isCurrentActive
              ? 'active-directory'
              : node.type === 'file'
              ? 'bg-gradient-to-br from-neutral-800 to-neutral-900 border-neutral-600 hover:border-amber-400 hover:scale-105'
              : 'bg-gradient-to-br from-[#4d1c3d] to-[#2c0b22] border-[#77216F] hover:border-[#E95420] hover:scale-105'
          } ${isBouncing ? 'bounce-ls' : ''}`}
        >
          {node.type === 'dir' ? (
            isCurrentActive ? (
              <FolderOpen className="w-4 h-4 sm:w-5 sm:h-5 text-amber-300 shrink-0" />
            ) : (
              <Folder className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 shrink-0" />
            )
          ) : (
            <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-neutral-300 shrink-0" />
          )}
          <span className="font-bold text-xs sm:text-sm md:text-base text-white tracking-wide truncate max-w-[110px] sm:max-w-[150px]">
            {node.name}
          </span>
        </div>

        {node.type === 'dir' && node.children && Object.keys(node.children).length > 0 && (
          <div className="tree-children flex flex-row justify-center items-start mt-8 sm:mt-12 relative">
            {Object.keys(node.children).map(childKey =>
              renderTreeNodeGroup(node.children![childKey], [...pathArr, childKey])
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-screen h-screen flex flex-col bg-[#0d020a] text-white overflow-hidden relative font-sans">
      
      {/* TOP HEADER NAVBAR (RESPONSIVE & MOBILE-OPTIMIZED) */}
      <header className="h-14 sm:h-16 w-full bg-gradient-to-r from-[#300A24] via-[#1e0517] to-[#4d1c3d] border-b-[2px] sm:border-b-[3px] border-[#E95420] flex items-center justify-between px-3 sm:px-6 shadow-2xl z-40 shrink-0">
        
        {/* Brand / Logo Zone */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-gradient-to-tr from-[#E95420] to-amber-500 flex items-center justify-center p-1 sm:p-1.5 shadow-md shrink-0">
            <svg className="w-full h-full fill-white" viewBox="0 0 24 24">
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zm0 3.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zm-5 8a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zm10 0a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z" />
            </svg>
          </div>
          <div>
            <h1 className="text-sm sm:text-lg md:text-xl font-black text-white tracking-wide flex items-center gap-1.5">
              <span>Ubuntu 22.04 LTS</span>
              <span className="hidden md:inline text-[11px] font-mono px-2 py-0.5 rounded bg-orange-950/80 text-orange-400 border border-orange-700/50">
                SIJA Interactive
              </span>
            </h1>
            <p className="text-[11px] text-orange-300/90 hidden md:block">
              Media Pembelajaran Terminal Linux & Visualisasi Direktori
            </p>
          </div>
        </div>

        {/* View Mode & Control Action Zone */}
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          
          {/* Mobile Screen View Switcher: Split / Bagan / Terminal */}
          <div className="flex items-center bg-black/40 border border-purple-800/80 rounded-lg p-0.5 sm:p-1">
            <button
              onClick={() => setViewMode('split')}
              className={`px-2 py-1 sm:px-2.5 sm:py-1 rounded text-[11px] sm:text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'split' 
                  ? 'bg-[#E95420] text-white shadow' 
                  : 'text-neutral-300 hover:text-white'
              }`}
              title="Tampilkan Bagan & Terminal Bersama"
            >
              Split
            </button>
            <button
              onClick={() => setViewMode('visualizer')}
              className={`px-2 py-1 sm:px-2.5 sm:py-1 rounded text-[11px] sm:text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'visualizer' 
                  ? 'bg-[#E95420] text-white shadow' 
                  : 'text-neutral-300 hover:text-white'
              }`}
              title="Perbesar Bagan Direktori Layar Penuh"
            >
              Bagan
            </button>
            <button
              onClick={() => setViewMode('terminal')}
              className={`px-2 py-1 sm:px-2.5 sm:py-1 rounded text-[11px] sm:text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'terminal' 
                  ? 'bg-[#E95420] text-white shadow' 
                  : 'text-neutral-300 hover:text-white'
              }`}
              title="Perbesar Terminal Layar Penuh"
            >
              Terminal
            </button>
          </div>

          {/* Materi Button */}
          <button
            onClick={() => setShowMateri(true)}
            className="bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-lg sm:rounded-xl border border-amber-300 shadow-md text-xs sm:text-sm transition-transform active:scale-95 flex items-center gap-1 cursor-pointer shrink-0"
          >
            <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-200" />
            <span className="hidden sm:inline">Materi</span>
          </button>

          {/* Reset Button */}
          <button
            onClick={handleResetFS}
            className="bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg sm:rounded-xl border border-neutral-600 text-xs sm:text-sm flex items-center gap-1 cursor-pointer transition-colors shrink-0"
            title="Reset Sistem Berkas ke Awal"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Reset</span>
          </button>
        </div>
      </header>

      {/* TOP SECTION: Directory Tree Visualizer Canvas */}
      <div 
        ref={visualizerRef}
        style={{
          display: viewMode === 'terminal' ? 'none' : 'block',
          height: viewMode === 'visualizer' ? 'calc(100vh - 56px)' : undefined
        }}
        className={`w-full bg-[radial-gradient(circle_at_center,#300a24_0%,#1e0517_70%,#0d020a_100%)] relative overflow-auto border-b-[2px] sm:border-b-[3px] border-[#E95420] shadow-[inset_0_0_60px_rgba(0,0,0,0.85)] transition-all duration-200 ${
          viewMode === 'visualizer' ? '' : 'flex-1 min-h-0'
        }`}
      >
        
        {/* Floating Zoom & Layout Controls */}
        <div className="sticky top-3 left-3 z-30 inline-flex items-center gap-1 bg-black/60 backdrop-blur-md border border-purple-700/60 p-1 rounded-xl shadow-xl">
          <button
            onClick={() => setZoomLevel(prev => Math.min(1.4, prev + 0.1))}
            className="p-1.5 text-neutral-200 hover:text-white hover:bg-purple-900/60 rounded-lg active:scale-95 transition-colors cursor-pointer"
            title="Perbesar Bagan (Zoom In)"
          >
            <ZoomIn className="w-4 h-4 text-orange-400" />
          </button>
          
          <button
            onClick={() => setZoomLevel(prev => Math.max(0.5, prev - 0.1))}
            className="p-1.5 text-neutral-200 hover:text-white hover:bg-purple-900/60 rounded-lg active:scale-95 transition-colors cursor-pointer"
            title="Perkecil Bagan (Zoom Out)"
          >
            <ZoomOut className="w-4 h-4 text-orange-400" />
          </button>

          <button
            onClick={() => {
              if (window.innerWidth < 640) {
                setZoomLevel(0.8);
              } else {
                setZoomLevel(1.0);
              }
            }}
            className="px-2 py-0.5 text-[11px] font-mono font-bold text-amber-300 hover:bg-purple-900/60 rounded-lg active:scale-95 transition-colors cursor-pointer"
            title="Kembalikan Ukuran Normal"
          >
            {Math.round(zoomLevel * 100)}%
          </button>

          {/* Quick Fit Button */}
          <button
            onClick={() => setZoomLevel(0.65)}
            className="hidden sm:inline-block px-2 py-0.5 text-[10px] uppercase font-bold text-neutral-300 hover:text-white hover:bg-purple-900/60 rounded-lg transition-colors cursor-pointer"
            title="Muat Seluruh Bagan (Fit All)"
          >
            Fit All
          </button>
        </div>

        {/* Scaled Inner Wrapper containing both SVG and Tree */}
        <div
          ref={innerZoomWrapperRef}
          style={{
            transform: `scale(${zoomLevel})`,
            transformOrigin: 'top center',
            width: 'max-content',
            minWidth: '100%',
            margin: '0 auto'
          }}
          className="relative transition-transform duration-150 p-4 sm:p-8 pt-6 min-h-full flex justify-center items-start"
        >
          <svg ref={svgRef} className="absolute top-0 left-0 w-full h-full pointer-events-none z-[1]" />
          <div className="relative z-[2] flex justify-center">
            {renderTreeNodeGroup(fs, [])}
          </div>
        </div>

      </div>

      {/* BOTTOM SECTION: Terminal Console (COMPACT: MAX 3 LINES LOGS IN SPLIT MODE) */}
      <div 
        style={{
          display: viewMode === 'visualizer' ? 'none' : 'flex',
          height: viewMode === 'terminal' ? 'calc(100vh - 56px)' : undefined
        }}
        className={`w-full bg-[#300A24] flex flex-col relative font-mono shadow-2xl transition-all duration-200 ${
          viewMode === 'terminal' ? 'flex-1' : 'shrink-0'
        }`}
      >
        {/* Virtual Keyboard Drawer (for Smart TV / Tablets) */}
        {showKeyboard && (
          <div className="absolute bottom-full left-0 w-full bg-[#111111] border-t-[3px] border-[#E95420] p-2 sm:p-3 grid grid-cols-10 gap-1 sm:gap-1.5 z-50 shadow-[-10px_0_30px_rgba(0,0,0,0.85)] animate-in fade-in slide-in-from-bottom duration-200">
            {['q','w','e','r','t','y','u','i','o','p'].map(char => (
              <button
                key={char}
                onClick={() => {
                  setInputValue(prev => prev + char);
                  inputRef.current?.focus();
                }}
                className="bg-[#2c0b22] hover:bg-[#E95420] text-white py-2 sm:py-2.5 font-bold rounded text-xs sm:text-base border border-[#77216F] active:scale-95"
              >
                {char}
              </button>
            ))}
            {['a','s','d','f','g','h','j','k','l','/'].map(char => (
              <button
                key={char}
                onClick={() => {
                  setInputValue(prev => prev + char);
                  inputRef.current?.focus();
                }}
                className="bg-[#2c0b22] hover:bg-[#E95420] text-white py-2 sm:py-2.5 font-bold rounded text-xs sm:text-base border border-[#77216F] active:scale-95"
              >
                {char}
              </button>
            ))}
            {['z','x','c','v','b','n','m','.','-','_'].map(char => (
              <button
                key={char}
                onClick={() => {
                  setInputValue(prev => prev + char);
                  inputRef.current?.focus();
                }}
                className="bg-[#2c0b22] hover:bg-[#E95420] text-white py-2 sm:py-2.5 font-bold rounded text-xs sm:text-base border border-[#77216F] active:scale-95"
              >
                {char}
              </button>
            ))}
            <button
              onClick={() => {
                setInputValue(prev => prev + ' ');
                inputRef.current?.focus();
              }}
              className="col-span-3 bg-[#E95420] hover:bg-orange-600 text-white py-2 font-bold rounded text-xs sm:text-base active:scale-95 cursor-pointer"
            >
              SPACE
            </button>
            <button
              onClick={() => {
                setInputValue(prev => prev.slice(0, -1));
                inputRef.current?.focus();
              }}
              className="col-span-2 bg-neutral-800 hover:bg-neutral-700 text-white py-2 font-bold rounded text-xs sm:text-base border border-neutral-600 active:scale-95 cursor-pointer"
            >
              ⌫ DEL
            </button>
            <button
              onClick={() => executeCommand()}
              className="col-span-3 bg-emerald-600 hover:bg-emerald-500 text-white py-2 font-bold rounded text-xs sm:text-base active:scale-95 cursor-pointer"
            >
              ↵ ENTER
            </button>
            <button
              onClick={() => setShowKeyboard(false)}
              className="col-span-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 py-2 font-bold rounded text-xs sm:text-base border border-neutral-700 cursor-pointer"
            >
              TUTUP
            </button>
          </div>
        )}

        {/* Logs Output Console (CUKUP MAKSIMAL 3 BARIS SAJA DI BAGIAN ATAS TERMINAL) */}
        <div 
          ref={terminalLogsRef} 
          className={`px-3 sm:px-5 overflow-y-auto text-xs sm:text-sm leading-snug text-white bg-black/45 select-text ${
            viewMode === 'terminal' 
              ? 'flex-1 p-3' 
              : 'h-[64px] sm:h-[72px] py-1.5'
          }`}
        >
          {logs.map(log => {
            if (log.type === 'command') {
              return (
                <div key={log.id} className="mb-0.5 break-all">
                  <span className="text-[#00FF66] font-bold">sija@ubuntu-server</span>
                  <span className="text-white">:</span>
                  <span className="text-[#66CCFF] font-bold">{log.path || '~'}</span>
                  <span className="text-white mr-1.5">$</span>
                  <span className="text-white font-medium">{log.text}</span>
                </div>
              );
            }
            if (log.type === 'error') {
              return <div key={log.id} className="mb-0.5 text-red-400 break-all">{log.text}</div>;
            }
            if (log.type === 'system') {
              return <div key={log.id} className="mb-0.5 text-[#FFDC00] font-semibold break-all">{log.text}</div>;
            }
            if (log.type === 'info') {
              return <div key={log.id} className="mb-0.5 text-[#66CCFF] break-all">{log.text}</div>;
            }
            return <div key={log.id} className="mb-0.5 text-neutral-200 break-all">{log.text}</div>;
          })}
        </div>

        {/* Input Prompt Bar */}
        <div className="flex items-center bg-[#1a0414] px-2.5 sm:px-4 py-2 border-t border-[#5E2750]">
          <span className="text-[#00FF66] font-bold text-xs sm:text-base shrink-0">sija@ubuntu-server</span>
          <span className="text-white">:</span>
          <span className="text-[#66CCFF] font-bold text-xs sm:text-base shrink-0 truncate max-w-[80px] sm:max-w-none">
            {formatPathString(currentPath)}
          </span>
          <span className="text-white mr-1.5 sm:mr-2.5 font-bold text-xs sm:text-base shrink-0">$</span>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            spellCheck="false"
            placeholder="Ketik perintah (ls, cd netplan, pwd, clear)..."
            className="flex-1 bg-transparent border-none outline-none text-[#00FF66] font-mono text-xs sm:text-sm md:text-base font-bold caret-[#E95420] placeholder-neutral-500"
          />
          {inputValue && (
            <button
              onClick={() => executeCommand()}
              className="ml-2 bg-[#E95420] hover:bg-orange-600 text-white px-2.5 py-1 rounded text-xs font-bold active:scale-95 shrink-0 cursor-pointer"
            >
              Kirim
            </button>
          )}
        </div>
      </div>

      {/* MATERIALS & COMMAND GUIDE MODAL (RESPONSIVE FULLSCREEN MODAL) */}
      {showMateri && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
          <div className="w-[96vw] sm:w-[94vw] h-[94vh] bg-gradient-to-br from-[#1a0414] via-[#0d020a] to-[#25071e] border-2 sm:border-[3px] border-[#E95420] rounded-xl sm:rounded-2xl shadow-[0_0_70px_rgba(0,0,0,0.95)] flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#77216F] to-[#E95420] px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between border-b-[3px] border-[#FFDC00] shrink-0">
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="text-2xl sm:text-3xl">📘</span>
                <div>
                  <h2 className="text-base sm:text-xl md:text-2xl font-black text-white">
                    Panduan Perintah Dasar Ubuntu Server
                  </h2>
                  <p className="text-[11px] sm:text-sm text-orange-200 line-clamp-1">
                    Deskripsi, sintaks, dan tombol coba langsung di terminal
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowMateri(false)}
                className="bg-red-600 hover:bg-red-700 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl font-bold border sm:border-2 border-white shadow-md transition-transform active:scale-95 flex items-center gap-1 cursor-pointer text-xs sm:text-sm shrink-0"
              >
                <X className="w-4 h-4" />
                <span>Tutup</span>
              </button>
            </div>

            {/* Modal Cards Grid */}
            <div className="flex-1 p-3 sm:p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
              {COMMAND_GUIDES.map(guide => (
                <div
                  key={guide.cmd}
                  className="bg-[#300A24]/90 hover:bg-[#4d1c3d]/95 border-2 border-[#77216F] hover:border-[#E95420] rounded-xl sm:rounded-2xl p-3.5 sm:p-5 flex flex-col justify-between gap-3 sm:gap-4 shadow-xl transition-all"
                >
                  <div>
                    <div className="text-base sm:text-lg font-black text-[#FFDC00] border-b border-purple-800 pb-2 mb-2 sm:mb-3 flex items-center gap-2">
                      <TerminalIcon className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 shrink-0" />
                      <span>{guide.name}</span>
                    </div>
                    <p className="text-neutral-200 text-xs sm:text-sm leading-relaxed mb-3">
                      {guide.desc}
                    </p>
                    <div className="bg-[#11030e] border border-purple-900 rounded-lg sm:rounded-xl p-2.5 sm:p-3 font-mono text-[11px] sm:text-xs md:text-sm mb-2">
                      <span className="text-emerald-400 font-bold block mb-1">Sintaks / Format:</span>
                      <pre className="text-white whitespace-pre-wrap font-mono">{guide.syntax}</pre>
                    </div>
                    <div className="bg-[#11030e] border border-purple-900 rounded-lg sm:rounded-xl p-2.5 sm:p-3 font-mono text-[11px] sm:text-xs md:text-sm">
                      <span className="text-blue-300 font-bold block mb-0.5">Contoh:</span>
                      <code className="text-amber-300">{guide.example}</code>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setShowMateri(false);
                      setInputValue(guide.quickTry);
                      executeCommand(guide.quickTry);
                    }}
                    className="w-full bg-[#E95420] hover:bg-orange-500 text-white font-extrabold py-2 sm:py-2.5 px-3 rounded-lg sm:rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors shadow-md active:scale-98 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-white" />
                    <span>Coba di Terminal</span>
                  </button>
                </div>
              ))}
            </div>

          </div>
        </div>
      )}

      {/* GNU NANO 6.2 TEXT EDITOR MODAL */}
      {nanoState.isOpen && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col font-mono text-white select-text">
          
          {/* Header */}
          <div className="bg-white text-black px-3 sm:px-4 py-1.5 sm:py-2 flex items-center justify-between font-bold text-xs sm:text-base shrink-0">
            <span>GNU nano 6.2</span>
            <span className="truncate max-w-[140px] sm:max-w-none">File: {nanoState.fileName}</span>
            <span className="text-red-700">{nanoState.isModified ? '[ Modified ]' : nanoState.statusTag}</span>
          </div>

          {/* Editor Area */}
          <textarea
            value={nanoState.content}
            onChange={(e) => {
              const val = e.target.value;
              setNanoState(prev => ({
                ...prev,
                content: val,
                isModified: val !== prev.originalContent
              }));
            }}
            spellCheck="false"
            placeholder="Ketik isi berkas konfigurasi di sini..."
            className="flex-1 w-full bg-black text-white p-3 sm:p-5 font-mono text-sm sm:text-base md:text-lg leading-relaxed outline-none resize-none caret-[#00FF66]"
          />

          {/* Touch Snippets */}
          <div className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-[#111111] border-t border-neutral-800 overflow-x-auto shrink-0">
            <span className="text-[11px] text-neutral-400 whitespace-nowrap">Netplan:</span>
            <button
              onClick={() => {
                const snippet = `network:
  version: 2
  renderer: networkd
  ethernets:
    enp0s3:
      dhcp4: no
      addresses: [192.168.1.50/24]
      gateway4: 192.168.1.1
      nameservers:
        addresses: [8.8.8.8, 8.8.4.4]
`;
                setNanoState(prev => ({
                  ...prev,
                  content: prev.content + snippet,
                  isModified: true
                }));
              }}
              className="bg-[#25071e] text-[#00FF66] border border-[#00FF66] px-2.5 py-1 rounded text-[11px] font-bold whitespace-nowrap hover:bg-[#00FF66] hover:text-black transition-colors"
            >
              + Template Netplan
            </button>
            <button
              onClick={() => {
                setNanoState(prev => ({
                  ...prev,
                  content: prev.content + 'addresses: [192.168.1.50/24]\n',
                  isModified: true
                }));
              }}
              className="bg-[#25071e] text-[#00FF66] border border-[#00FF66] px-2.5 py-1 rounded text-[11px] font-bold whitespace-nowrap hover:bg-[#00FF66] hover:text-black transition-colors"
            >
              + IP Address
            </button>
            <button
              onClick={() => {
                setNanoState(prev => ({
                  ...prev,
                  content: prev.content + 'gateway4: 192.168.1.1\n',
                  isModified: true
                }));
              }}
              className="bg-[#25071e] text-[#00FF66] border border-[#00FF66] px-2.5 py-1 rounded text-[11px] font-bold whitespace-nowrap hover:bg-[#00FF66] hover:text-black transition-colors"
            >
              + Gateway
            </button>
            <button
              onClick={() => {
                setNanoState(prev => ({
                  ...prev,
                  content: prev.content + 'nameservers:\n  addresses: [8.8.8.8, 8.8.4.4]\n',
                  isModified: true
                }));
              }}
              className="bg-[#25071e] text-[#00FF66] border border-[#00FF66] px-2.5 py-1 rounded text-[11px] font-bold whitespace-nowrap hover:bg-[#00FF66] hover:text-black transition-colors"
            >
              + DNS Server
            </button>
          </div>

          {/* Footer Shortcuts */}
          <div className="bg-neutral-200 text-black grid grid-cols-4 gap-1 sm:gap-1.5 p-1.5 sm:p-2 font-bold text-[11px] sm:text-xs md:text-sm shrink-0">
            <button
              onClick={handleNanoSave}
              className="bg-neutral-300 hover:bg-[#E95420] hover:text-white p-2 text-center rounded active:scale-95 transition-colors cursor-pointer"
            >
              ^O Simpan
            </button>
            <button
              onClick={handleNanoExit}
              className="bg-neutral-300 hover:bg-[#E95420] hover:text-white p-2 text-center rounded active:scale-95 transition-colors cursor-pointer"
            >
              ^X Keluar
            </button>
            <button
              onClick={() => {
                setNanoState(prev => ({
                  ...prev,
                  content: prev.content + '# Konfigurasi Network Ubuntu\n',
                  isModified: true
                }));
              }}
              className="bg-neutral-300 hover:bg-[#E95420] hover:text-white p-2 text-center rounded active:scale-95 transition-colors cursor-pointer"
            >
              # Komentar
            </button>
            <button
              onClick={() => {
                setNanoState(prev => ({
                  ...prev,
                  content: '',
                  isModified: true
                }));
              }}
              className="bg-neutral-300 hover:bg-red-600 hover:text-white p-2 text-center rounded active:scale-95 transition-colors cursor-pointer"
            >
              🧹 Bersihkan
            </button>
          </div>

          {/* Save Confirmation Dialog */}
          {nanoState.showConfirmDialog && (
            <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
              <div className="bg-[#300A24] border-[3px] border-[#E95420] p-5 sm:p-7 rounded-2xl text-center shadow-[0_0_60px_rgba(0,0,0,0.95)] max-w-md w-full">
                <h3 className="text-lg sm:text-xl font-bold text-white mb-2">Save modified buffer?</h3>
                <p className="text-neutral-400 text-xs sm:text-sm mb-5">(Menjawab Tidak akan membuang semua perubahan yang belum disimpan)</p>
                <div className="flex items-center justify-center gap-2 sm:gap-3">
                  <button
                    onClick={() => handleNanoConfirmExit(true)}
                    className="bg-[#00FF66] hover:bg-emerald-400 text-black px-4 py-2 sm:px-5 sm:py-2.5 font-bold rounded-xl active:scale-95 transition-colors cursor-pointer text-xs sm:text-sm"
                  >
                    Ya, Simpan (Y)
                  </button>
                  <button
                    onClick={() => handleNanoConfirmExit(false)}
                    className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 sm:px-5 sm:py-2.5 font-bold rounded-xl active:scale-95 transition-colors cursor-pointer text-xs sm:text-sm"
                  >
                    Tidak, Buang (N)
                  </button>
                  <button
                    onClick={() => setNanoState(prev => ({ ...prev, showConfirmDialog: false }))}
                    className="bg-neutral-600 hover:bg-neutral-500 text-white px-4 py-2 sm:px-5 sm:py-2.5 font-bold rounded-xl active:scale-95 transition-colors cursor-pointer text-xs sm:text-sm"
                  >
                    Batal (^C)
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
