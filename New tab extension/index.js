const VIRAL_ICON_CDN = 'https://raw.githubusercontent.com/Zero09090/new-tab-icons/main/Viral%20icon%20pack/';
let defaultState = null;
let state = null;
let currentFolderId = null;

// Modal tracking state
let editingFolderId = null;
let editingCardId = null;

document.addEventListener('DOMContentLoaded', async () => {
  await loadState();

  // Initialize UI
  applySettings();
  renderFolders();
  if (state.folders.length > 0) {
    const homeFolder = state.folders.find(f => f.name.toLowerCase() === 'home');
    currentFolderId = homeFolder ? homeFolder.id : state.folders[0].id;
    renderFolders(); // to apply active class
    renderCards(currentFolderId);
  }

  setupEventListeners();
  fetchWeather();
});

// --- STATE MANAGEMENT ---

async function loadState() {
  // First, fetch the default templates
  try {
    const response = await fetch('default_templates.json');
    defaultState = await response.json();
  } catch (e) {
    console.error('Failed to load default templates:', e);
    defaultState = { folders: [], cards: {}, settings: { bgUrl: '', searchEngine: 'google' } };
  }

  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['appState'], (result) => {
        if (result.appState) {
          state = result.appState;
        } else {
          state = JSON.parse(JSON.stringify(defaultState));
        }

        // Initialize categories if missing
        if (!state.categories) {
          state.categories = ['Social Media', 'Entertainment', 'Development', 'Productivity', 'Shopping', 'Education', 'News & Media', 'Finance', 'Design', 'Travel', 'Cloud & Storage', 'AI & Tools', 'Other'];
        }

        if (!state.categoryHierarchy) {
          state.categoryHierarchy = {};
        }

        if (!state.disabledAutoSort) {
          state.disabledAutoSort = {};
        }
        
        if (!state.settings) state.settings = {};
        if (state.settings.sidebarFold === undefined) state.settings.sidebarFold = false;
        if (state.settings.sidebarFoldTimeout === undefined) state.settings.sidebarFoldTimeout = 30;
        if (state.settings.bgMode === undefined) state.settings.bgMode = 'static';
        if (state.settings.unsplashTag === undefined) state.settings.unsplashTag = 'cyberpunk';
        if (state.settings.bgFit === undefined) state.settings.bgFit = 'cover';
        if (state.settings.openRouterKey === undefined) state.settings.openRouterKey = '';
        if (state.settings.aiModel === undefined) state.settings.aiModel = 'google/gemini-2.0-flash-001';
        if (state.settings.weatherLat === undefined) state.settings.weatherLat = 31.427796;
        if (state.settings.weatherLon === undefined) state.settings.weatherLon = 31.811222;
        if (state.userIcons === undefined) state.userIcons = [];
        
        if (state.sidebarLocked === undefined) state.sidebarLocked = false;

        saveState();
        resolve();
      });
    } else {
      // Fallback for simple local browser testing without extension context
      const localData = localStorage.getItem('appState');
      if (localData) {
        state = JSON.parse(localData);
      } else {
        state = JSON.parse(JSON.stringify(defaultState));
      }

      // Initialize categories if missing
      if (!state.categories) {
        state.categories = ['Social Media', 'Entertainment', 'Development', 'Productivity', 'Shopping', 'Education', 'News & Media', 'Finance', 'Design', 'Travel', 'Cloud & Storage', 'AI & Tools', 'Other'];
      }

      if (!state.categoryHierarchy) {
        state.categoryHierarchy = {};
      }

      if (!state.disabledAutoSort) {
        state.disabledAutoSort = {};
      }

      saveState();
      resolve();
    }
  });
}

function saveState() {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.set({ appState: state });
  } else {
    localStorage.setItem('appState', JSON.stringify(state));
  }
}

// --- RENDER LOGIC ---

function applySettings() {
  // Background
  const bgLayer = document.getElementById('bg-layer');
  const auraContainer = document.getElementById('aura-container');
  const mode = state.settings.bgMode || 'static';
  const fit = state.settings.bgFit || 'cover';

  bgLayer.style.backgroundSize = fit;

  if (mode === 'static') {
    auraContainer.style.display = 'none';
    bgLayer.style.display = 'block';
    bgLayer.style.opacity = '1';
    bgLayer.style.backgroundImage = `url('${state.settings.bgUrl || 'wallpaper.png'}')`;
  } else if (mode === 'unsplash') {
    auraContainer.style.display = 'none';
    bgLayer.style.display = 'block';
    bgLayer.style.opacity = '1';
    fetchUnsplashImage();
  } else if (mode === 'aura') {
    bgLayer.style.opacity = '0';
    setTimeout(() => { if (state.settings.bgMode === 'aura') bgLayer.style.display = 'none'; }, 500);
    auraContainer.style.display = 'block';
    initAuraBackground();
  }

  const searchInput = document.getElementById('search-input');
  const engineIcon = document.getElementById('engine-icon');

  const engines = {
    google: { name: 'Google', icon: 'G' },
    bing: { name: 'Bing', icon: 'B' },
    duckduckgo: { name: 'DuckDuckGo', icon: 'D' },
    yahoo: { name: 'Yahoo', icon: 'Y' }
  };

  const engine = engines[state.settings.searchEngine] || engines.google;
  engineIcon.textContent = engine.icon;
  searchInput.placeholder = `Search with ${engine.name}...`;

  // Start/Reset fold timer
  if (state.settings.sidebarFold) {
    resetSidebarFoldTimer();
  } else if (sidebarFoldTimeoutId) {
    clearTimeout(sidebarFoldTimeoutId);
  }
}

function renderFolders() {
  const folderList = document.getElementById('folder-list');

  // Group folders by category
  const categoryMap = {};
  state.folders.forEach(folder => {
    const cat = folder.category || 'Other';
    if (!categoryMap[cat]) categoryMap[cat] = [];
    categoryMap[cat].push(folder);
  });

  // Ensure all categories in state are represented in the map
  state.categories.forEach(cat => {
    if (!categoryMap[cat]) categoryMap[cat] = [];
  });

  // Track collapsed categories
  if (!state.collapsedCategories) state.collapsedCategories = {};
  if (!state.categoryHierarchy) state.categoryHierarchy = {};
  
  // Toggle sidebar edit mode class
  const sidebar = document.getElementById('sidebar');
  if (state.sidebarEditMode) {
    sidebar.classList.add('sidebar-edit-mode');
  } else {
    sidebar.classList.remove('sidebar-edit-mode');
  }

  // Update Lock Button visual
  const lockBtn = document.getElementById('sidebar-lock-btn');
  if (lockBtn) {
    if (state.sidebarLocked) {
      lockBtn.classList.add('locked');
      lockBtn.innerHTML = '🔒';
    } else {
      lockBtn.classList.remove('locked');
      lockBtn.innerHTML = '🔓';
    }
  }

  // Build hierarchy structure
  const topLevelCategories = [];
  const subCategories = {}; // parent -> [children]

  state.categories.forEach(cat => {
    const parent = state.categoryHierarchy[cat];
    if (parent && state.categories.includes(parent)) {
      if (!subCategories[parent]) subCategories[parent] = [];
      subCategories[parent].push(cat);
    } else {
      topLevelCategories.push(cat);
    }
  });

  let html = '';
  let categoryCounter = 1;

  function renderCategory(cat, isSub = false) {
    const isCollapsed = state.collapsedCategories[cat];
    const folders = categoryMap[cat] || [];
    const children = subCategories[cat] || [];
    
    const totalCount = folders.length + children.length;
    const isAutoSortDisabled = state.disabledAutoSort[cat];
    const promoteBtn = isSub ? `<button class="category-promote-btn" title="Move to Top Level">⇧</button>` : '';
    
    // Category numbering for edit mode
    let numberBadge = '';
    if (state.sidebarEditMode) {
      numberBadge = `<span class="category-number">${categoryCounter++}</span>`;
    }

    html += `<li class="folder-category-header ${isCollapsed ? 'collapsed' : ''} ${isSub ? 'sub-category' : ''}" 
                 data-category="${cat}" draggable="true">
      <span class="category-arrow">${isCollapsed ? '▶' : '▼'}</span>
      ${numberBadge}
      <span class="category-name">${cat}</span>
      <div class="category-actions">
        <span class="category-count">${totalCount}</span>
        ${promoteBtn}
        <button class="category-edit-btn" title="Edit Category">✎</button>
        <button class="category-sort-btn" title="Run Smart Sort & Consolidate">🪄</button>
        <button class="category-sort-toggle ${isAutoSortDisabled ? 'disabled' : ''}" title="${isAutoSortDisabled ? 'Enable Auto-Sort' : 'Disable Auto-Sort'}">
          ⚡
        </button>
      </div>
    </li>`;

    if (!isCollapsed) {
      // Render sub-categories recursively
      children.forEach(sub => renderCategory(sub, true));

      // Render folders in this category
      html += folders.map(folder => `
        <li class="folder-item ${folder.id === currentFolderId ? 'active' : ''} ${isSub ? 'sub-item' : ''}" 
            data-id="${folder.id}" draggable="true">
          <span class="folder-icon">${folder.icon}</span>
          <span class="folder-name">${folder.name}</span>
          <div class="folder-edit-btn" title="Edit Island">✎</div>
        </li>
      `).join('');
    }
  }

  // Ensure any categories in folders NOT in state.categories are added to topLevel
  Object.keys(categoryMap).forEach(cat => {
    if (!state.categories.includes(cat) && !topLevelCategories.includes(cat)) {
      topLevelCategories.push(cat);
    }
  });

  topLevelCategories.forEach(cat => renderCategory(cat));

  folderList.innerHTML = html;
  setupFolderDragAndDrop();
  
  // Category Auto-Sort Toggle Listeners
  folderList.querySelectorAll('.category-sort-toggle').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const cat = e.target.closest('.folder-category-header').dataset.category;
      state.disabledAutoSort[cat] = !state.disabledAutoSort[cat];
      
      // If just enabled, run the sort immediately
      if (!state.disabledAutoSort[cat]) {
        smartSortCategory(cat);
      } else {
        saveState();
        renderFolders();
      }
    });
  });

  // Category Manual Sort Listeners
  folderList.querySelectorAll('.category-sort-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const cat = e.target.closest('.folder-category-header').dataset.category;
      smartSortCategory(cat);
    });
  });

  // Category Promote Listeners
  folderList.querySelectorAll('.category-promote-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const cat = e.target.closest('.folder-category-header').dataset.category;
      delete state.categoryHierarchy[cat];
      saveState();
      renderFolders();
    });
  });

  // Category Edit Listeners
  folderList.querySelectorAll('.category-edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const cat = e.target.closest('.folder-category-header').dataset.category;
      openCategoryModal(cat);
    });
  });
}

function organizeSidebar(triggerCat = null) {
  // 1. Name-based PULL logic (Global or per-category)
  const catsToOrganize = triggerCat ? [triggerCat] : state.categories.filter(c => !state.disabledAutoSort[c]);

  catsToOrganize.forEach(parentCat => {
    const catLower = parentCat.toLowerCase();
    
    // Islands
    state.folders.forEach(f => {
      if (f.category !== parentCat && f.name.toLowerCase().includes(catLower)) {
        console.log(`Auto-moving Island "${f.name}" to category "${parentCat}"`);
        f.category = parentCat;
      }
    });

    // Sub-categories
    state.categories.forEach(subCat => {
      if (subCat !== parentCat && state.categoryHierarchy[subCat] !== parentCat && subCat.toLowerCase().includes(catLower)) {
        // Prevent cycles
        let curr = parentCat;
        let cycle = false;
        while (curr) {
          if (curr === subCat) { cycle = true; break; }
          curr = state.categoryHierarchy[curr];
        }
        if (!cycle) {
          console.log(`Auto-moving Category "${subCat}" into "${parentCat}"`);
          state.categoryHierarchy[subCat] = parentCat;
        }
      }
    });
  });

  // 2. Alphabetize Islands within their categories
  state.categories.forEach(cat => {
    const inCat = state.folders.filter(f => f.category === cat);
    if (!state.disabledAutoSort[cat]) {
      inCat.sort((a, b) => a.name.localeCompare(b.name));
    }
  });

  // 3. Rebuild folders array based on (now possibly changed) category order
  const newFolders = [];
  const processedCategoryFolders = new Set();
  
  state.categories.forEach(cat => {
    const fForCat = state.folders.filter(f => f.category === cat);
    if (!state.disabledAutoSort[cat]) fForCat.sort((a, b) => a.name.localeCompare(b.name));
    newFolders.push(...fForCat);
    processedCategoryFolders.add(cat);
  });

  // Add any orphans
  state.folders.forEach(f => {
    if (!state.categories.includes(f.category)) newFolders.push(f);
  });
  state.folders = newFolders;

  // 4. Rebuild categories array to reflect hierarchy (Top level followed by children)
  const newCategories = [];
  function collectRecursive(parent) {
    if (!newCategories.includes(parent)) newCategories.push(parent);
    const children = state.categories.filter(c => state.categoryHierarchy[c] === parent);
    if (!state.disabledAutoSort[parent]) children.sort((a, b) => a.localeCompare(b));
    children.forEach(collectRecursive);
  }

  // Get current top levels
  const topLevels = state.categories.filter(c => !state.categoryHierarchy[c] || !state.categories.includes(state.categoryHierarchy[c]));
  topLevels.forEach(collectRecursive);

  // Add any that were missed by the hierarchy tree
  state.categories.forEach(c => {
    if (!newCategories.includes(c)) newCategories.push(c);
  });

  state.categories = newCategories;
}

function smartSortCategory(category) {
  organizeSidebar(category);
  saveState();
  renderFolders();
}

function runAllAutoSorts() {
  organizeSidebar();
  saveState();
  renderFolders();
}

// --- FOLDER DRAG AND DROP ---
function setupFolderDragAndDrop() {
  const folderList = document.getElementById('folder-list');
  const items = folderList.querySelectorAll('.folder-item[draggable="true"]');
  const catHeaders = folderList.querySelectorAll('.folder-category-header');
  
  let draggedId = null;
  let dragType = null; // 'folder' or 'category'

  items.forEach(item => {
    item.addEventListener('dragstart', (e) => {
      if (state.sidebarLocked) {
        e.preventDefault();
        showSidebarNotification("🔒 Sidebar Locked! Unlock it from the top header to move items.");
        return;
      }
      draggedId = item.dataset.id;
      dragType = 'folder';
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('sourceId', draggedId);
      e.dataTransfer.setData('sourceType', dragType);
    });

    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      draggedId = null;
      dragType = null;
      folderList.querySelectorAll('.folder-item, .folder-category-header').forEach(c => c.classList.remove('drag-over'));
    });

    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (dragType === 'folder' && item.dataset.id !== draggedId) {
        item.classList.add('drag-over');
      }
    });

    item.addEventListener('dragleave', () => {
      item.classList.remove('drag-over');
    });

    item.addEventListener('drop', (e) => {
      if (state.sidebarLocked) {
        e.preventDefault();
        e.stopPropagation();
        item.classList.remove('drag-over');
        showSidebarNotification("🔒 Sidebar Locked! Unlock it from the top header to move items.");
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      item.classList.remove('drag-over');
      
      const sourceId = e.dataTransfer.getData('sourceCardId');
      const sourceType = e.dataTransfer.getData('sourceType');
      const sourceFolderId = e.dataTransfer.getData('sourceFolderId');
      const targetFolderId = item.dataset.id;

      if (sourceType === 'card' && sourceId && sourceFolderId) {
        if (sourceFolderId === targetFolderId) return;

        // Move card between folders
        const sourceCards = state.cards[sourceFolderId] || [];
        const cardIndex = sourceCards.findIndex(c => c.id === sourceId);
        
        if (cardIndex !== -1) {
          const [card] = sourceCards.splice(cardIndex, 1);
          if (!state.cards[targetFolderId]) state.cards[targetFolderId] = [];
          state.cards[targetFolderId].push(card);
          
          saveState();
          renderFolders();
          if (currentFolderId === sourceFolderId || currentFolderId === targetFolderId) {
            renderCards(currentFolderId);
          }
        }
        return;
      }

      if (dragType !== 'folder' || !draggedId || item.dataset.id === draggedId) return;

      const fromIdx = state.folders.findIndex(f => f.id === draggedId);
      const toIdx = state.folders.findIndex(f => f.id === item.dataset.id);
      if (fromIdx === -1 || toIdx === -1) return;

      const [moved] = state.folders.splice(fromIdx, 1);
      moved.category = state.folders[Math.min(toIdx, state.folders.length - 1)]?.category || moved.category;
      state.folders.splice(toIdx, 0, moved);

      saveState();
      renderFolders();
    });
  });

  catHeaders.forEach(header => {
    header.addEventListener('dragstart', (e) => {
      if (state.sidebarLocked) {
        e.preventDefault();
        showSidebarNotification("🔒 Sidebar Locked! Unlock it from the top header to move items.");
        return;
      }
      draggedId = header.dataset.category;
      dragType = 'category';
      header.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('sourceId', draggedId);
      e.dataTransfer.setData('sourceType', dragType);
    });

    header.addEventListener('dragend', () => {
      header.classList.remove('dragging');
      draggedId = null;
      dragType = null;
      folderList.querySelectorAll('.folder-item, .folder-category-header').forEach(c => {
        c.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom');
      });
    });

    header.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (draggedId === header.dataset.category) return;
      
      const rect = header.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      
      header.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom');
      
      if (dragType === 'category') {
        if (relativeY < rect.height * 0.25) {
          header.classList.add('drag-over-top');
        } else if (relativeY > rect.height * 0.75) {
          header.classList.add('drag-over-bottom');
        } else {
          header.classList.add('drag-over');
        }
      } else {
        header.classList.add('drag-over');
      }
    });

    header.addEventListener('dragleave', () => {
      header.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom');
    });

    header.addEventListener('drop', (e) => {
      if (state.sidebarLocked) {
        e.preventDefault();
        e.stopPropagation();
        header.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom');
        showSidebarNotification("🔒 Sidebar Locked! Unlock it from the top header to move items.");
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      
      const targetCat = header.dataset.category;
      const rect = header.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      
      header.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom');
      
      if (dragType === 'folder') {
        const fromIdx = state.folders.findIndex(f => f.id === draggedId);
        if (fromIdx === -1) return;

        const [moved] = state.folders.splice(fromIdx, 1);
        moved.category = targetCat;
        
        state.folders.push(moved);
        
        if (!state.disabledAutoSort[targetCat]) {
          smartSortCategory(targetCat);
        } else {
          saveState();
          renderFolders();
        }
      } else if (dragType === 'category') {
        if (draggedId === targetCat) return;

        // REORDER vs NEST
        if (relativeY < rect.height * 0.25 || relativeY > rect.height * 0.75) {
          // Reorder logic
          const fromIdx = state.categories.indexOf(draggedId);
          let toIdx = state.categories.indexOf(targetCat);
          if (fromIdx === -1 || toIdx === -1) return;

          // Inherit the target's parent (instead of becoming top-level)
          const targetParent = state.categoryHierarchy[targetCat];
          if (targetParent) {
            state.categoryHierarchy[draggedId] = targetParent;
          } else {
            delete state.categoryHierarchy[draggedId];
          }

          state.categories.splice(fromIdx, 1);
          // Recalculate toIdx after splice if necessary
          toIdx = state.categories.indexOf(targetCat);
          if (relativeY > rect.height * 0.75) {
            state.categories.splice(toIdx + 1, 0, draggedId);
          } else {
            state.categories.splice(toIdx, 0, draggedId);
          }
        } else {
          // Nest logic (current behavior)
          // Prevent cycles
          let curr = targetCat;
          while (curr) {
            if (curr === draggedId) return;
            curr = state.categoryHierarchy[curr];
          }
          state.categoryHierarchy[draggedId] = targetCat;
        }
      }

      saveState();
      renderFolders();
    });
  });

  // Handle dropping category onto the list
  folderList.addEventListener('dragover', (e) => {
    e.preventDefault();
  });

  folderList.addEventListener('drop', (e) => {
    if (dragType === 'category' && draggedId) {
      if (e.target === folderList || e.target.classList.contains('folder-item')) {
        delete state.categoryHierarchy[draggedId];
        saveState();
        renderFolders();
      }
    }
  });
}

function renderCards(folderId) {
  const cardsContainer = document.getElementById('cards-container');
  if (!folderId) {
    cardsContainer.innerHTML = '';
    return;
  }

  const cards = state.cards[folderId] || [];

  const cardsHTML = cards.map((card, index) => {
    let iconSrc = card.icon;
    if (iconSrc && iconSrc.startsWith('Viral icon pack/')) {
      iconSrc = iconSrc.replace('Viral icon pack/', VIRAL_ICON_CDN);
    }
    return `
    <a href="${card.url}" target="_blank" rel="noopener noreferrer" class="card" data-id="${card.id}" data-index="${index}" draggable="true">
      <div class="card-edit-btn" title="Edit Shortcut">✎</div>
      <div class="card-left">
        <img src="${iconSrc}" alt="${card.title}" class="card-icon">
      </div>
      <div class="card-right">
        <span class="card-title">${card.title}</span>
        ${card.subtitle ? `<span class="card-subtitle">${card.subtitle}</span>` : ''}
      </div>
    </a>
  `}).join('');

  const addBtnHTML = `
    <div class="card add-card" id="add-card-btn">
      <span>+ Add Shortcut</span>
    </div>
  `;

  cardsContainer.innerHTML = cardsHTML + addBtnHTML;

  // Setup drag-and-drop on newly rendered cards
  setupCardDragAndDrop();
}

// --- DRAG AND DROP ---

let draggedCard = null;
let draggedIndex = null;

function setupCardDragAndDrop() {
  const cardsContainer = document.getElementById('cards-container');
  const cards = cardsContainer.querySelectorAll('.card[draggable="true"]');

  cards.forEach(card => {
    card.addEventListener('dragstart', (e) => {
      draggedCard = card;
      draggedIndex = parseInt(card.dataset.index);
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      
      // Store both card ID and the source folder
      e.dataTransfer.setData('sourceCardId', card.dataset.id);
      e.dataTransfer.setData('sourceFolderId', currentFolderId);
      e.dataTransfer.setData('sourceType', 'card');
    });

    card.addEventListener('dragend', () => {
      if (draggedCard) draggedCard.classList.remove('dragging');
      draggedCard = null;
      draggedIndex = null;
      // Remove all drag-over indicators
      cardsContainer.querySelectorAll('.card').forEach(c => c.classList.remove('drag-over'));
    });

    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (card !== draggedCard && card.draggable) {
        card.classList.add('drag-over');
      }
    });

    card.addEventListener('dragleave', () => {
      card.classList.remove('drag-over');
    });

    card.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      card.classList.remove('drag-over');

      if (!draggedCard || card === draggedCard) return;

      const targetIndex = parseInt(card.dataset.index);
      if (isNaN(targetIndex) || isNaN(draggedIndex)) return;

      // Reorder in state
      const folderCards = state.cards[currentFolderId];
      const [movedCard] = folderCards.splice(draggedIndex, 1);
      folderCards.splice(targetIndex, 0, movedCard);

      saveState();
      renderCards(currentFolderId);
    });

    // Prevent default link behavior when dragging
    card.addEventListener('click', (e) => {
      if (card.classList.contains('dragging')) {
        e.preventDefault();
      }
    });
  });
}

// --- EVENT LISTENERS ---

function setupEventListeners() {
  // Fallback icon (1x1 transparent pixel) when no icon is found
  const FALLBACK_ICON = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

  document.addEventListener('error', (e) => {
    if (e.target && e.target.tagName === 'IMG' && e.target.classList.contains('card-icon')) {
      const img = e.target;
      if (img.dataset.fallbackTried) return;
      img.dataset.fallbackTried = 'true';

      const card = img.closest('a.card');
      if (!card) { img.src = FALLBACK_ICON; return; }

      const cardId = card.dataset.id;
      const cardData = state.cards[currentFolderId]?.find(c => c.id === cardId);
      
      // PROTECTION: Don't fetch auto-favicon if it's a user icon or in dedicated folder
      if (cardData && (cardData.isUserIcon || (cardData.icon && cardData.icon.startsWith('Cards Uploaded Images/')))) {
        img.src = FALLBACK_ICON;
        return;
      }

      try {
        const u = new URL(card.href);
        const faviconUrl = `https://icons.duckduckgo.com/ip3/${u.hostname}.ico`;

        fetch(faviconUrl)
          .then(r => r.blob())
          .then(blob => {
            // Convert blob to data URL first (avoids tainted canvas from cross-origin)
            const reader = new FileReader();
            reader.onload = function() {
              const dataUri = reader.result;
              const tmpImg = new Image();
              tmpImg.onload = function() {
                const canvas = document.createElement('canvas');
                canvas.width = 128;
                canvas.height = 128;
                const ctx = canvas.getContext('2d');
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';

                // "Smart Scaling" logic:
                const w = this.naturalWidth || 16;
                const h = this.naturalHeight || 16;
                const maxDim = Math.max(w, h);
                let drawW, drawH, drawX, drawY;

                if (maxDim < 128) {
                  // Small icon: center at natural size without stretching
                  drawW = w;
                  drawH = h;
                  drawX = (128 - w) / 2;
                  drawY = (128 - h) / 2;
                } else {
                  // Large icon: fill 128x128 maintaining aspect ratio
                  const aspect = w / h;
                  if (aspect > 1) { // Wide
                    drawH = 128;
                    drawW = 128 * aspect;
                    drawX = (128 - drawW) / 2;
                    drawY = 0;
                  } else { // Tall or Square
                    drawW = 128;
                    drawH = 128 / aspect;
                    drawX = 0;
                    drawY = (128 - drawH) / 2;
                  }
                }
                
                ctx.drawImage(this, drawX, drawY, drawW, drawH);

                const upscaledUrl = canvas.toDataURL('image/png');
                img.src = upscaledUrl;

                // Save into state so it persists and never re-fetches
                const cardId = card.dataset.id;
                if (currentFolderId && state.cards[currentFolderId]) {
                  const cardData = state.cards[currentFolderId].find(c => c.id === cardId);
                  if (cardData) {
                    cardData.icon = upscaledUrl;
                    saveState();
                  }
                }
              };
              tmpImg.onerror = () => { img.src = FALLBACK_ICON; };
              tmpImg.src = dataUri;
            };
            reader.readAsDataURL(blob);
          })
          .catch(() => { img.src = FALLBACK_ICON; });
      } catch {
        img.src = FALLBACK_ICON;
      }
    }
  }, true);

  // Auto-upscale small icons (e.g. 16x16 or 32x32 favicons) to 128x128
  document.addEventListener('load', (e) => {
    if (e.target && e.target.tagName === 'IMG' && e.target.classList.contains('card-icon')) {
      const img = e.target;
      if (img.dataset.processed) return;
      
      // PROTECTION: Check if this is a user icon before even considering upscale
      const card = img.closest('a.card');
      const cardId = card?.dataset.id;
      const cardData = state.cards[currentFolderId]?.find(c => c.id === cardId);
      if (cardData && (cardData.isUserIcon || (cardData.icon && cardData.icon.startsWith('Cards Uploaded Images/')))) {
        img.dataset.processed = 'true';
        return;
      }

      // If image is loaded and is small, upscale it to 128x128 via canvas
      if (img.naturalWidth > 0 && img.naturalWidth < 64) {
        img.dataset.processed = 'true';
        upscaleAndSave(img);
      }
    }
  }, true);

  // Helper to upscale image on canvas and save to state
  function upscaleAndSave(img) {
    const card = img.closest('a.card');
    if (!card) return;

    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // "Smart Scaling" logic:
    const w = img.naturalWidth || 16;
    const h = img.naturalHeight || 16;
    const maxDim = Math.max(w, h);
    let drawW, drawH, drawX, drawY;

    if (maxDim < 128) {
      // Small icon: center at natural size without stretching
      drawW = w;
      drawH = h;
      drawX = (128 - w) / 2;
      drawY = (128 - h) / 2;
    } else {
      // Large icon: fill 128x128 maintaining aspect ratio
      const aspect = w / h;
      if (aspect > 1) { // Wide
        drawH = 128;
        drawW = 128 * aspect;
        drawX = (128 - drawW) / 2;
        drawY = 0;
      } else { // Tall or Square
        drawW = 128;
        drawH = 128 / aspect;
        drawX = 0;
        drawY = (128 - drawH) / 2;
      }
    }
    
    ctx.drawImage(img, drawX, drawY, drawW, drawH);

    const upscaledUrl = canvas.toDataURL('image/png');
    img.src = upscaledUrl;
    updateCardState(img, upscaledUrl);
  }

  // Helper to update card icon data in the global state
  function updateCardState(img, iconValue) {
    const card = img.closest('a.card');
    if (!card) return;
    const cardId = card.dataset.id;
    if (currentFolderId && state.cards[currentFolderId]) {
      const cardData = state.cards[currentFolderId].find(c => c.id === cardId);
      if (cardData) {
        // PROTECTION: Don't overwrite icons if they are user-uploaded or in the dedicated folder
        if (cardData.isUserIcon || (cardData.icon && cardData.icon.startsWith('Cards Uploaded Images/'))) return;
        cardData.icon = iconValue;
        saveState();
      }
    }
  }

  // Search Submission
  const searchInput = document.getElementById('search-input');
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && searchInput.value.trim() !== '') {
      const query = encodeURIComponent(searchInput.value.trim());
      const engine = state.settings.searchEngine;

      let searchUrl = `https://www.google.com/search?q=${query}`;
      if (engine === 'bing') searchUrl = `https://www.bing.com/search?q=${query}`;
      if (engine === 'duckduckgo') searchUrl = `https://duckduckgo.com/?q=${query}`;
      if (engine === 'yahoo') searchUrl = `https://search.yahoo.com/search?p=${query}`;

      window.location.href = searchUrl;
    }
  });

  // Search Engine Selector Dropdown
  const engineSelector = document.getElementById('engine-icon');
  const engineDropdown = document.getElementById('engine-dropdown');

  engineSelector.addEventListener('click', (e) => {
    e.stopPropagation();
    engineDropdown.style.display = engineDropdown.style.display === 'none' ? 'flex' : 'none';
  });

  document.addEventListener('click', () => {
    engineDropdown.style.display = 'none';
  });

  engineDropdown.addEventListener('click', (e) => {
    if (e.target.tagName === 'LI') {
      const selectedEngine = e.target.dataset.engine;
      state.settings.searchEngine = selectedEngine;
      saveState();
      applySettings();
    }
  });

  // Sidebar Toggle
  const sidebar = document.getElementById('sidebar');
  const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');

  sidebarToggleBtn.addEventListener('click', () => {
    sidebar.classList.toggle('hidden');
    if (sidebar.classList.contains('hidden')) {
      sidebarToggleBtn.textContent = '▶';
      sidebarToggleBtn.style.left = '16px';
    } else {
      sidebarToggleBtn.textContent = '◀';
      sidebarToggleBtn.style.left = '286px';
    }
  });

  // Template Suggestions in Card Modal
  const cardUrlInput = document.getElementById('card-url-input');
  const cardTitleInput = document.getElementById('card-title-input');
  const templateSuggestions = document.getElementById('template-suggestions');

  function showTemplateSuggestions(query) {
    if (!query || query.length < 2) {
      templateSuggestions.style.display = 'none';
      return;
    }
    const q = query.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].split('.')[0];
    if (q.length < 2) { templateSuggestions.style.display = 'none'; return; }

    let results = [];

    // 1. Search templates from default_templates.json first (has full info)
    const searchWords = q.split(/[\s_]+/).filter(w => w.length > 0);

    if (defaultState && defaultState.templates) {
      const templateMatches = defaultState.templates.filter(t => {
        if (searchWords.length === 0) return true;
        const cleanName = t.name.toLowerCase();
        const cleanUrl = t.url.toLowerCase();
        const cleanIcon = t.icon.toLowerCase();

        return searchWords.every(word =>
          cleanName.includes(word) || cleanUrl.includes(word) || cleanIcon.includes(word)
        );
      });

      // Sort: exact name matches first, then by name length (shorter = more relevant)
      templateMatches.sort((a, b) => {
        const aExact = a.name.toLowerCase() === q ? -2 : (a.name.toLowerCase().startsWith(q) ? -1 : 0);
        const bExact = b.name.toLowerCase() === q ? -2 : (b.name.toLowerCase().startsWith(q) ? -1 : 0);
        if (aExact !== bExact) return aExact - bExact;
        return a.name.length - b.name.length;
      });

      const sliced = templateMatches.slice(0, 8);

      results = sliced.map(t => ({
        name: t.name,
        subtitle: t.subtitle,
        url: t.url,
        icon: t.icon,
        isTemplate: true
      }));
    }

    // 2. If fewer than 6 results, supplement with viralIcons (icon-only)
    if (results.length < 8 && typeof viralIcons !== 'undefined') {
      const existingIcons = new Set(results.map(r => r.icon));
      const iconMatches = viralIcons.filter(icon => {
        const path = `Viral icon pack/${icon}`;
        if (existingIcons.has(path)) return false;
        if (searchWords.length === 0) return true;

        const cleanIcon = icon.replace('.png', '').toLowerCase();
        return searchWords.every(word => cleanIcon.includes(word));
      }).slice(0, 8 - results.length);

      iconMatches.forEach(icon => {
        const displayName = icon.replace('.png', '').replace(/_/g, ' ');
        const capitalName = displayName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        results.push({
          name: capitalName,
          subtitle: '',
          url: '',
          icon: `Viral icon pack/${icon}`,
          isTemplate: false
        });
      });
    }

    if (results.length === 0) {
      templateSuggestions.style.display = 'none';
      return;
    }

    templateSuggestions.innerHTML = results.map(r => {
      const badge = r.isTemplate ? '<span style="font-size:0.6rem; padding:2px 6px; background:rgba(255,215,0,0.2); color:gold; border-radius:4px; margin-left:6px;">TEMPLATE</span>' : '';
      return `<div class="template-suggestion-item" data-icon="${r.icon}" data-name="${r.name}" data-url="${r.url}" data-subtitle="${r.subtitle || ''}">
        <img src="${r.icon}" onerror="this.style.display='none'">
        <div class="suggestion-info">
          <span class="suggestion-name">${r.name}${badge}</span>
          <span class="suggestion-file">${r.isTemplate ? r.url : r.icon.replace('Viral icon pack/', '')}</span>
        </div>
      </div>`;
    }).join('');

    templateSuggestions.style.display = 'block';
  }

  // Listen to URL input
  cardUrlInput.addEventListener('input', () => showTemplateSuggestions(cardUrlInput.value));
  // Also listen to title input
  cardTitleInput.addEventListener('input', () => showTemplateSuggestions(cardTitleInput.value));

  // Handle clicking a suggestion — fills ALL fields
  templateSuggestions.addEventListener('click', (e) => {
    const item = e.target.closest('.template-suggestion-item');
    if (!item) return;

    const iconPath = item.dataset.icon;
    const name = item.dataset.name;
    const url = item.dataset.url;
    const subtitle = item.dataset.subtitle;

    // Auto-fill ALL fields
    document.getElementById('card-title-input').value = name;
    if (url) document.getElementById('card-url-input').value = url;
    if (subtitle) document.getElementById('card-subtitle-input').value = subtitle;
    document.getElementById('card-icon-input').value = iconPath;
    updatePreview(iconPath, 'card-icon-preview');
    templateSuggestions.style.display = 'none';
  });

  // Sidebar Folder Clicks
  const folderList = document.getElementById('folder-list');
  folderList.addEventListener('click', (e) => {
    // Category header toggle
    const catHeader = e.target.closest('.folder-category-header');
    if (catHeader) {
      const cat = catHeader.dataset.category;
      if (!state.collapsedCategories) state.collapsedCategories = {};
      state.collapsedCategories[cat] = !state.collapsedCategories[cat];
      saveState();
      renderFolders();
      return;
    }

    const editBtn = e.target.closest('.folder-edit-btn');
    const li = e.target.closest('.folder-item');

    if (editBtn && li) {
      e.preventDefault();
      e.stopPropagation();
      openFolderModal(li.dataset.id);
    } else if (li) {
      currentFolderId = li.dataset.id;
      renderFolders();
      renderCards(currentFolderId);
    }
  });

  // Cards Area Clicks
  const cardsContainer = document.getElementById('cards-container');
  cardsContainer.addEventListener('click', (e) => {
    const editBtn = e.target.closest('.card-edit-btn');
    const addBtn = e.target.closest('#add-card-btn');
    const card = e.target.closest('.card');

    if (editBtn && card) {
      e.preventDefault(); // Prevent navigating to URL
      e.stopPropagation(); // Stop event bubbling
      openCardModal(card.dataset.id);
    } else if (addBtn) {
      openCardModal();
    }
  });

  // Settings & Add Folder Buttons
  document.getElementById('settings-btn').addEventListener('click', openSettingsModal);

  // Settings Modal Live Listeners
  document.getElementById('bg-mode-select').addEventListener('change', () => {
    toggleSettingsVisibility();
    applyAndSaveSettings();
  });
  document.getElementById('unsplash-tag-input').addEventListener('input', applyAndSaveSettings);
  document.getElementById('bg-fit-select').addEventListener('change', () => {
    refreshFitPreview();
    applyAndSaveSettings();
  });
  document.getElementById('bg-url-input').addEventListener('input', () => {
    refreshFitPreview();
    applyAndSaveSettings();
  });
  document.getElementById('bg-url-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
      const base64 = await fileToBase64(file);
      refreshFitPreview(base64);
      applyAndSaveSettings();
    }
  });
  document.getElementById('search-engine-select').addEventListener('change', applyAndSaveSettings);
  document.getElementById('sidebar-fold-enable').addEventListener('change', () => {
    document.getElementById('fold-timeout-wrapper').style.display = document.getElementById('sidebar-fold-enable').checked ? 'flex' : 'none';
    applyAndSaveSettings();
  });
  document.getElementById('sidebar-fold-timeout').addEventListener('input', applyAndSaveSettings);

  // AI Settings Listeners
  document.getElementById('ai-api-key-input').addEventListener('input', (e) => {
    state.settings.openRouterKey = e.target.value.trim();
    saveState();
    updateAIStatus();
  });
  document.getElementById('ai-model-select').addEventListener('change', (e) => {
    state.settings.aiModel = e.target.value;
    saveState();
  });
  document.getElementById('ai-test-btn').addEventListener('click', (e) => {
    e.preventDefault();
    testOpenRouterConnection();
  });
  document.getElementById('ai-bulk-btn').addEventListener('click', (e) => {
    e.preventDefault();
    autoSubtitleAllCards();
  });
  document.getElementById('ai-toggle-key-btn').addEventListener('click', (e) => {
    e.preventDefault();
    const input = document.getElementById('ai-api-key-input');
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  document.getElementById('settings-close-btn').addEventListener('click', () => closeModal('settings-modal'));

  // Modals Save/Cancel Buttons
  document.getElementById('folder-cancel-btn').addEventListener('click', () => closeModal('folder-modal'));
  document.getElementById('folder-save-btn').addEventListener('click', saveFolder);
  document.getElementById('folder-delete-btn').addEventListener('click', deleteFolder);

  document.getElementById('card-cancel-btn').addEventListener('click', () => closeModal('card-modal'));
  document.getElementById('card-save-btn').addEventListener('click', saveCard);
  document.getElementById('card-delete-btn').addEventListener('click', deleteCard);

  // Backup & Restore
  // Backup & Restore
  document.getElementById('export-backup-btn').addEventListener('click', exportBackup);
  document.getElementById('import-backup-file').addEventListener('change', importBackup);



  // Google Drive Sync
  document.getElementById('gdrive-upload-btn').addEventListener('click', uploadToGDrive);
  document.getElementById('gdrive-download-btn').addEventListener('click', downloadFromGDrive);

  document.getElementById('card-icon-input').addEventListener('input', (e) => updatePreview(e.target.value, 'card-icon-preview'));
  document.getElementById('card-icon-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) updatePreview(await fileToBase64(file), 'card-icon-preview');
  });

  document.getElementById('sidebar-lock-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    state.sidebarLocked = !state.sidebarLocked;
    saveState();
    renderFolders();
  });

  document.getElementById('edit-categories-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    state.sidebarEditMode = !state.sidebarEditMode;
    const btn = document.getElementById('edit-categories-btn');
    if (state.sidebarEditMode) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
    saveState();
    renderFolders();
  });

  // Sidebar Activity Listeners (to reset fold timer)
  ['mousedown', 'mousemove', 'keydown', 'scroll'].forEach(evt => {
    sidebar.addEventListener(evt, resetSidebarFoldTimer, { passive: true });
  });

  document.getElementById('bg-url-input').addEventListener('input', (e) => updatePreview(e.target.value, 'bg-icon-preview'));
  document.getElementById('bg-url-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) updatePreview(await fileToBase64(file), 'bg-icon-preview');
  });

  // Icon and Favicon Picker Modals
  document.getElementById('fetch-favicon-btn').addEventListener('click', (e) => {
    e.preventDefault();
    const urlInput = document.getElementById('card-url-input').value.trim();
    if (!urlInput) {
      alert("Please enter a URL first to fetch its favicon.");
      return;
    }
    try {
      let validUrl = urlInput;
      if (!/^https?:\/\//i.test(validUrl)) validUrl = 'https://' + validUrl;
      const u = new URL(validUrl);
      const faviconUrl = `https://icons.duckduckgo.com/ip3/${u.hostname}.ico`;
      
      const btn = e.target;
      const originalText = btn.textContent;
      btn.textContent = '⌛...';
      btn.disabled = true;

      fetch(faviconUrl)
        .then(r => r.blob())
        .then(blob => {
          const isSuspicious = blob.size < 1500;
          
          const reader = new FileReader();
          reader.onload = function() {
            const tmpImg = new Image();
            tmpImg.onload = function() {
              const canvas = document.createElement('canvas');
              canvas.width = 128;
              canvas.height = 128;
              const ctx = canvas.getContext('2d');
              ctx.imageSmoothingEnabled = true;
              ctx.imageSmoothingQuality = 'high';

              // "Smart Scaling" logic:
              const w = this.naturalWidth || 16;
              const h = this.naturalHeight || 16;
              const maxDim = Math.max(w, h);
              let drawW, drawH, drawX, drawY;

              if (maxDim < 128) {
                // Small icon: center at natural size without stretching
                drawW = w;
                drawH = h;
                drawX = (128 - w) / 2;
                drawY = (128 - h) / 2;
              } else {
                // Large icon: fill 128x128 maintaining aspect ratio
                const aspect = w / h;
                if (aspect > 1) { // Wide
                  drawH = 128;
                  drawW = 128 * aspect;
                  drawX = (128 - drawW) / 2;
                  drawY = 0;
                } else { // Tall or Square
                  drawW = 128;
                  drawH = 128 / aspect;
                  drawX = 0;
                  drawY = (128 - drawH) / 2;
                }
              }
              
              ctx.drawImage(this, drawX, drawY, drawW, drawH);

              const upscaledUrl = canvas.toDataURL('image/png');
              
              // If it looks like a placeholder, ask the user
              if (isSuspicious) {
                if (!confirm('This icon looks like a low-quality placeholder. Do you want to use it anyway?')) {
                  document.getElementById('card-icon-input').value = FALLBACK_ICON;
                  updatePreview(FALLBACK_ICON, 'card-icon-preview');
                  btn.textContent = originalText;
                  btn.disabled = false;
                  return;
                }
              }

              document.getElementById('card-icon-input').value = upscaledUrl;
              updatePreview(upscaledUrl, 'card-icon-preview');
              
              btn.textContent = originalText;
              btn.disabled = false;
            };
            tmpImg.src = reader.result;
          };
          reader.readAsDataURL(blob);
        })
        .catch((err) => {
          if (err.message === 'default icon') {
            alert('No high-quality favicon found. The default placeholder was filtered out to keep your dashboard clean.');
          } else {
            alert('Could not fetch favicon. The site might not have one or the service is unavailable.');
          }
          document.getElementById('card-icon-input').value = FALLBACK_ICON;
          updatePreview(FALLBACK_ICON, 'card-icon-preview');
          btn.textContent = originalText;
          btn.disabled = false;
        });
    } catch {
      alert("Invalid URL entered.");
      btn.textContent = originalText;
      btn.disabled = false;
    }
  });

  document.getElementById('browse-icons-btn').addEventListener('click', (e) => {
    e.preventDefault();
    openIconPicker();
  });
  document.getElementById('icon-picker-cancel-btn').addEventListener('click', () => closeModal('icon-picker-modal'));
  document.getElementById('icon-search-input').addEventListener('input', (e) => renderIconPickerGrid(e.target.value));

  // Sidebar Add Toggle & Dropdown Listeners
  const addMainBtn = document.getElementById('add-main-btn');
  const addDropdown = document.getElementById('add-dropdown');

  addMainBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    addDropdown.style.display = addDropdown.style.display === 'none' ? 'flex' : 'none';
  });

  document.addEventListener('click', () => {
    addDropdown.style.display = 'none';
  });

  document.getElementById('dropdown-add-island').addEventListener('click', () => {
    openFolderModal();
    addDropdown.style.display = 'none';
  });

  document.getElementById('dropdown-add-category').addEventListener('click', () => {
    openCategoryModal();
    addDropdown.style.display = 'none';
  });

  // Category Modal Save/Cancel
  document.getElementById('category-cancel-btn').addEventListener('click', () => closeModal('category-modal'));
  document.getElementById('category-save-btn').addEventListener('click', () => saveCategory());

  // Sidebar Search
  const sidebarSearchToggle = document.getElementById('sidebar-search-toggle');
  const sidebarSearchContainer = document.getElementById('sidebar-search-container');
  const sidebarSearchInput = document.getElementById('sidebar-search-input');
  
  if (sidebarSearchToggle && sidebarSearchContainer && sidebarSearchInput) {
    sidebarSearchToggle.addEventListener('click', () => {
      if (sidebarSearchContainer.style.display === 'none') {
        sidebarSearchContainer.style.display = 'block';
        sidebarSearchInput.focus();
      } else {
        sidebarSearchContainer.style.display = 'none';
        sidebarSearchInput.value = '';
        renderFolders(); 
      }
    });

    sidebarSearchInput.addEventListener('input', () => {
      const q = sidebarSearchInput.value.toLowerCase().trim();
      if (!q) {
        renderFolders(); 
        return;
      }
      
      let results = [];
      Object.keys(state.cards).forEach(folderId => {
        const folder = state.folders.find(f => f.id === folderId);
        const folderName = folder ? folder.name : 'Unknown';
        
        state.cards[folderId].forEach(card => {
          if (card.title.toLowerCase().includes(q) || 
              (card.subtitle && card.subtitle.toLowerCase().includes(q)) ||
              (card.url && card.url.toLowerCase().includes(q))) {
            results.push({ type: 'card', ...card, folderName });
          }
        });
      });
      
      state.folders.forEach(f => {
        if (f.name.toLowerCase().includes(q) || (f.category && f.category.toLowerCase().includes(q))) {
          results.push({ type: 'folder', ...f });
        }
      });

      results = results.slice(0, 15);
      
      const list = document.getElementById('folder-list');
      list.innerHTML = results.map(r => {
        if (r.type === 'card') {
          return `<li class="folder-item" style="padding-left: 15px; margin: 4px 0; border-radius: 8px;">
            <a href="${r.url}" target="_blank" style="text-decoration: none; color: inherit; display: flex; align-items: center; gap: 8px; width: 100%; padding: 4px;">
              <img src="${r.icon}" style="width: 16px; height: 16px; border-radius: 4px;">
              <div style="display: flex; flex-direction: column;">
                <span style="font-size: 0.85rem;">${r.title}</span>
                <span style="font-size: 0.65rem; color: rgba(255,255,255,0.5);">in ${r.folderName}</span>
              </div>
            </a>
          </li>`;
        } else {
          return `<li class="folder-item" data-id="${r.id}" style="padding-left: 15px; margin: 4px 0; border-radius: 8px;">
            <span class="folder-icon">${r.icon}</span>
            <span class="folder-name">${r.name}</span>
            <span style="font-size: 0.65rem; color: rgba(255,255,255,0.5); margin-left: auto;">Island</span>
          </li>`;
        }
      }).join('');
    });
  }

  // Sidebar Folder Clicks
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeModal(overlay.id);
      }
    });
  });

  // --- Settings Tabs ---
  const settingsTabs = document.querySelectorAll('.settings-tab-btn');
  const settingsPanels = document.querySelectorAll('.settings-tab-panel');

  settingsTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Deactivate all
      settingsTabs.forEach(t => t.classList.remove('active'));
      settingsPanels.forEach(p => p.style.display = 'none');
      // Activate clicked
      tab.classList.add('active');
      const targetId = tab.dataset.target;
      document.getElementById(targetId).style.display = 'block';
    });
  });
  // --- Command Palette (Ctrl+K) ---
  const cmdModal = document.getElementById('command-palette-modal');
  const cmdInput = document.getElementById('command-search-input');
  const cmdResults = document.getElementById('command-results-container');
  let cmdSelectedIndex = -1;

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault(); // Prevent browser search focus
      cmdModal.style.display = 'flex';
      cmdInput.value = '';
      cmdResults.innerHTML = '';
      cmdInput.focus();
    } else if (e.key === 'Escape' && cmdModal.style.display === 'flex') {
      cmdModal.style.display = 'none';
      const searchInput = document.getElementById('search-input');
      if (searchInput) searchInput.focus();
    }
  });

  cmdModal.addEventListener('click', (e) => {
    if (e.target === cmdModal) {
      cmdModal.style.display = 'none';
    }
  });

  cmdInput.addEventListener('input', () => {
    const q = cmdInput.value.toLowerCase();
    cmdResults.innerHTML = '';
    cmdSelectedIndex = -1;
    
    if (!q) return;

    let results = [];
    Object.keys(state.cards).forEach(folderId => {
      const folder = state.folders.find(f => f.id === folderId);
      const folderName = folder ? folder.name : 'Unknown';
      
      state.cards[folderId].forEach(card => {
        if (card.title.toLowerCase().includes(q) || 
            (card.subtitle && card.subtitle.toLowerCase().includes(q)) ||
            (card.url && card.url.toLowerCase().includes(q))) {
          results.push({ ...card, folderName });
        }
      });
    });

    results = results.slice(0, 10); // max 10 results

    results.forEach((r, idx) => {
      const el = document.createElement('a');
      el.href = r.url;
      el.target = '_blank';
      el.rel = "noopener noreferrer";
      el.className = 'command-result-item';
      
      el.innerHTML = `
        <img src="${r.icon}" class="command-result-icon">
        <div class="command-result-details">
          <span class="command-result-title">${r.title}</span>
          <span class="command-result-path">in ${r.folderName}</span>
        </div>
      `;
      
      el.addEventListener('click', () => {
        cmdModal.style.display = 'none';
      });
      
      cmdResults.appendChild(el);
    });
  });

  cmdInput.addEventListener('keydown', (e) => {
    const items = cmdResults.querySelectorAll('.command-result-item');
    if (items.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      cmdSelectedIndex = (cmdSelectedIndex + 1) % items.length;
      updateCmdSelection(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      cmdSelectedIndex = (cmdSelectedIndex - 1 + items.length) % items.length;
      updateCmdSelection(items);
    } else if (e.key === 'Enter' && cmdSelectedIndex >= 0) {
      e.preventDefault();
      items[cmdSelectedIndex].click();
    }
  });

  function updateCmdSelection(items) {
    items.forEach((item, idx) => {
      if (idx === cmdSelectedIndex) {
        item.classList.add('selected');
        item.scrollIntoView({ block: 'nearest' });
      } else {
        item.classList.remove('selected');
      }
    });
  }
}

// --- AI SUBTITLE GENERATION ---

async function generateAISubtitle(url, title) {
  const apiKey = state.settings.openRouterKey;
  if (!apiKey) return '';

  const model = state.settings.aiModel || 'google/gemini-2.0-flash-001';

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'chrome-extension://new-tab',
        'X-Title': 'New Tab Extension'
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'system',
            content: 'You generate very short website descriptions. Respond with ONLY a brief subtitle (5-10 words max) describing what the website is. No quotes, no punctuation at the end, no explanations. Examples: "Professional social networking platform", "Video sharing and streaming service", "Open source code hosting platform".'
          },
          {
            role: 'user',
            content: `Website: ${title} (${url})`
          }
        ],
        max_tokens: 30,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      console.error('AI subtitle generation failed:', response.status);
      return '';
    }

    const data = await response.json();
    const subtitle = data.choices?.[0]?.message?.content?.trim() || '';
    // Clean up: remove quotes if the model wrapped it
    return subtitle.replace(/^["']|["']$/g, '').replace(/\.$/, '');
  } catch (err) {
    console.error('AI subtitle generation error:', err);
    return '';
  }
}

async function testOpenRouterConnection() {
  const statusEl = document.getElementById('ai-status');
  const statusText = statusEl.querySelector('.ai-status-text');
  let apiKey = document.getElementById('ai-api-key-input').value.trim();

  // Clean the prefix if user pasted it
  if (apiKey.toLowerCase().startsWith('bearer ')) {
    apiKey = apiKey.slice(7).trim();
  }

  if (!apiKey) {
    statusEl.className = 'ai-status failed';
    statusText.textContent = 'Please enter an API key first';
    return;
  }

  statusEl.className = 'ai-status loading';
  statusText.textContent = 'Testing connection...';

  const model = document.getElementById('ai-model-select').value;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        "Authorization": "Bearer " + apiKey,
        "HTTP-Referer": "https://github.com/StartYourCoding",
        "X-Title": "New Tab Extension",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: 'Say OK' }],
        max_tokens: 5
      })
    });

    if (response.ok) {
      const data = await response.json();
      const reply = data.choices?.[0]?.message?.content?.trim() || '';
      statusEl.className = 'ai-status connected';
      statusText.textContent = `Connected ✅ — Model replied: "${reply}"`;
    } else {
      const errData = await response.json().catch(() => ({}));
      statusEl.className = 'ai-status failed';
      statusText.textContent = `Failed ❌ — ${errData.error?.message || 'HTTP ' + response.status}`;
    }
  } catch (err) {
    statusEl.className = 'ai-status failed';
    statusText.textContent = `Failed ❌ — Network error: ${err.message}`;
  }
}

function updateAIStatus() {
  const statusEl = document.getElementById('ai-status');
  if (!statusEl) return;
  const statusText = statusEl.querySelector('.ai-status-text');
  const apiKey = document.getElementById('ai-api-key-input').value.trim();

  if (apiKey) {
    statusEl.className = 'ai-status';
    statusText.textContent = 'Key entered — click Test Connection to verify';
  } else {
    statusEl.className = 'ai-status';
    statusText.textContent = 'Not configured';
  }
}

async function autoSubtitleAllCards() {
  if (!state.settings.openRouterKey) return alert('Please configure your OpenRouter API key first.');

  const emptyCards = [];
  Object.keys(state.cards).forEach(folderId => {
    state.cards[folderId].forEach(card => {
      if (!card.subtitle) {
        emptyCards.push({ folderId, card });
      }
    });
  });

  if (emptyCards.length === 0) return alert('No empty subtitles found!');

  const btn = document.getElementById('ai-bulk-btn');
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `⌛ Generating for ${emptyCards.length} cards...`;

  // Concurrency limit of 3
  const limit = 3;
  const queue = [...emptyCards];
  let active = 0;
  let finished = 0;

  async function processNext() {
    if (queue.length === 0) return;
    active++;
    const { folderId, card } = queue.shift();

    // Show loading on card if visible
    const cardEl = document.querySelector(`.card[data-id="${card.id}"]`);
    if (cardEl) cardEl.classList.add('ai-loading');

    try {
      const aiSubtitle = await generateAISubtitle(card.url, card.title);
      if (aiSubtitle) {
        card.subtitle = aiSubtitle;
      }
    } catch (e) {
      console.error('Bulk generation failed for card:', card.id, e);
    }

    finished++;
    active--;
    btn.innerHTML = `⌛ Done ${finished}/${emptyCards.length}...`;

    // Finalize when all are done
    if (finished === emptyCards.length) {
      saveState();
      renderCards(currentFolderId);
      btn.disabled = false;
      btn.innerHTML = originalText;
      alert(`Successfully processed ${finished} cards!`);
    } else {
      processNext();
    }
  }

  for (let i = 0; i < Math.min(limit, queue.length); i++) {
    processNext();
  }
}

// --- MODAL LOGIC ---

function updatePreview(url, imgId) {
  const imgEL = document.getElementById(imgId);
  if (url) {
    if (url.startsWith('Viral icon pack/')) {
      url = url.replace('Viral icon pack/', VIRAL_ICON_CDN);
    }
    imgEL.src = url;
    imgEL.style.display = 'block';
  } else {
    imgEL.src = '';
    imgEL.style.display = 'none';
  }
}

function openModal(id) {
  const modal = document.getElementById(id);
  modal.classList.add('show');
}

function closeModal(id) {
  const modal = document.getElementById(id);
  modal.classList.remove('show');
}

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

// FOLDER MODAL
function populateCategoryDropdown() {
  const catSelect = document.getElementById('folder-category-input');
  if (!catSelect) return;
  catSelect.innerHTML = state.categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
}

function openFolderModal(folderId = null) {
  editingFolderId = folderId;
  const title = document.getElementById('folder-modal-title');
  const nameInput = document.getElementById('folder-name-input');
  const iconInput = document.getElementById('folder-icon-input');
  const deleteBtn = document.getElementById('folder-delete-btn');

  populateCategoryDropdown();

  if (folderId) {
    const folder = state.folders.find(f => f.id === folderId);
    title.textContent = 'Edit Island';
    nameInput.value = folder.name;
    iconInput.value = folder.icon;
    const catInput = document.getElementById('folder-category-input');
    catInput.value = folder.category || 'Other';
    deleteBtn.style.display = 'block';
  } else {
    title.textContent = 'Add New Island';
    nameInput.value = '';
    iconInput.value = '🏝️';
    const catInput = document.getElementById('folder-category-input');
    catInput.value = 'Other';
    deleteBtn.style.display = 'none';
  }
  openModal('folder-modal');
  nameInput.focus();
}

function saveFolder() {
  const name = document.getElementById('folder-name-input').value.trim();
  const icon = document.getElementById('folder-icon-input').value.trim() || '📁';
  const category = document.getElementById('folder-category-input').value.trim() || 'Other';
  if (!name) return alert('Name is required');

  let needsAutoSort = false;

  if (editingFolderId) {
    const folder = state.folders.find(f => f.id === editingFolderId);
    if (folder.category !== category || folder.name !== name) needsAutoSort = true;
    folder.name = name;
    folder.icon = icon;
    folder.category = category;
  } else {
    const newFolder = { id: 'f_' + generateId(), name, icon, category };
    state.folders.push(newFolder);
    state.cards[newFolder.id] = [];
    currentFolderId = newFolder.id;
    needsAutoSort = true; // New folder always triggers a check
  }

  if (needsAutoSort) {
    runAllAutoSorts();
  } else {
    saveState();
    renderFolders();
  }
  
  renderCards(currentFolderId);
  closeModal('folder-modal');
}

function runAllAutoSorts() {
  state.categories.forEach(cat => {
    if (!state.disabledAutoSort[cat]) {
      smartSortCategory(cat);
    }
  });
  saveState();
  renderFolders();
}

// CATEGORY MODAL
let editingCategoryName = null;

function openCategoryModal(catName = null) {
  editingCategoryName = catName;
  const title = document.querySelector('#category-modal h3');
  const nameInput = document.getElementById('category-name-input');
  const parentInput = document.getElementById('category-parent-input');
  
  // Build hierarchy structure for the dropdown
  const topLevels = state.categories.filter(c => !state.categoryHierarchy[c]);
  const subCats = {};
  state.categories.forEach(c => {
    const p = state.categoryHierarchy[c];
    if (p) {
      if (!subCats[p]) subCats[p] = [];
      subCats[p].push(c);
    }
  });

  const availableOptions = [];
  function collectOptions(cat, depth = 0) {
    // Cycle check for current editing category
    if (catName) {
      if (cat === catName) return;
      let curr = cat;
      let isChild = false;
      while (curr) {
        if (curr === catName) { isChild = true; break; }
        curr = state.categoryHierarchy[curr];
      }
      if (isChild) return;
    }

    const prefix = depth > 0 ? "\u00A0\u00A0".repeat(depth) + "↳ " : "";
    availableOptions.push(`<option value="${cat}">${prefix}${cat}</option>`);
    
    const children = subCats[cat] || [];
    children.sort((a,b) => a.localeCompare(b));
    children.forEach(child => collectOptions(child, depth + 1));
  }

  topLevels.sort((a,b) => a.localeCompare(b));
  topLevels.forEach(cat => collectOptions(cat));

  parentInput.innerHTML = '<option value="">None (Top Level)</option>' + availableOptions.join('');

  if (catName) {
    title.textContent = 'Edit Category';
    nameInput.value = catName;
    parentInput.value = state.categoryHierarchy[catName] || '';
  } else {
    title.textContent = 'Add Category';
    nameInput.value = '';
    parentInput.value = '';
  }

  openModal('category-modal');
  nameInput.focus();
}

function saveCategory() {
  const name = document.getElementById('category-name-input').value.trim();
  const parent = document.getElementById('category-parent-input').value;

  if (!name) return alert('Category name is required');

  if (editingCategoryName) {
    // Rename in categories array
    const idx = state.categories.indexOf(editingCategoryName);
    if (idx !== -1) state.categories[idx] = name;

    // Rename in folders
    state.folders.forEach(f => {
      if (f.category === editingCategoryName) f.category = name;
    });

    // Rename in hierarchy keys and values
    Object.keys(state.categoryHierarchy).forEach(key => {
      if (state.categoryHierarchy[key] === editingCategoryName) {
        state.categoryHierarchy[key] = name;
      }
    });
    if (state.categoryHierarchy[editingCategoryName]) {
      const p = state.categoryHierarchy[editingCategoryName];
      delete state.categoryHierarchy[editingCategoryName];
      state.categoryHierarchy[name] = p;
    }
    
    // Explicitly update parent if changed
    if (parent) {
      state.categoryHierarchy[name] = parent;
    } else {
      delete state.categoryHierarchy[name];
    }

    // Rename in disabledAutoSort
    if (state.disabledAutoSort[editingCategoryName] !== undefined) {
      const val = state.disabledAutoSort[editingCategoryName];
      delete state.disabledAutoSort[editingCategoryName];
      state.disabledAutoSort[name] = val;
    }

  } else {
    if (state.categories.includes(name)) return alert('Category already exists');
    state.categories.push(name);
    if (parent) state.categoryHierarchy[name] = parent;
  }

  saveState();
  closeModal('category-modal');
  runAllAutoSorts();
}

function deleteFolder() {
  if (confirm('Are you sure you want to delete this folder and all its shortcuts?')) {
    state.folders = state.folders.filter(f => f.id !== editingFolderId);
    delete state.cards[editingFolderId];

    if (currentFolderId === editingFolderId) {
      currentFolderId = state.folders.length > 0 ? state.folders[0].id : null;
    }

    saveState();
    renderFolders();
    renderCards(currentFolderId);
    closeModal('folder-modal');
  }
}

// CARD MODAL
function openCardModal(cardId = null) {
  if (!currentFolderId) return alert('Please create a folder first.');
  editingCardId = cardId;

  const title = document.getElementById('card-modal-title');
  const titleInput = document.getElementById('card-title-input');
  const subtitleInput = document.getElementById('card-subtitle-input');
  const urlInput = document.getElementById('card-url-input');
  const folderInput = document.getElementById('card-folder-input');
  const iconInput = document.getElementById('card-icon-input');
  const iconFile = document.getElementById('card-icon-file');
  const deleteBtn = document.getElementById('card-delete-btn');

  // Populate islands/folders list
  folderInput.innerHTML = state.folders.map(f => `<option value="${f.id}">${f.name}</option>`).join('');
  folderInput.value = currentFolderId;

  if (cardId) {
    const card = state.cards[currentFolderId].find(c => c.id === cardId);
    title.textContent = 'Edit Shortcut';
    titleInput.value = card.title;
    subtitleInput.value = card.subtitle || '';
    urlInput.value = card.url;
    iconInput.value = card.icon.startsWith('data:image') ? '' : card.icon;
    iconFile.value = ''; // Reset file
    deleteBtn.style.display = 'block';
    updatePreview(card.icon, 'card-icon-preview');
  } else {
    title.textContent = 'Add Shortcut';
    titleInput.value = '';
    subtitleInput.value = '';
    urlInput.value = '';
    iconInput.value = '';
    iconFile.value = ''; // Reset file
    deleteBtn.style.display = 'none';
    updatePreview('', 'card-icon-preview');
  }

  openModal('card-modal');
  // Hide any previous suggestions
  document.getElementById('template-suggestions').style.display = 'none';
  titleInput.focus();
}

async function saveCard() {
  const title = document.getElementById('card-title-input').value.trim();
  const subtitle = document.getElementById('card-subtitle-input').value.trim();
  let url = document.getElementById('card-url-input').value.trim();
  let iconUrl = document.getElementById('card-icon-input').value.trim();
  const folderId = document.getElementById('card-folder-input').value;
  const iconFile = document.getElementById('card-icon-file').files[0];

  if (!title || !url) return alert('Title and URL are required');

  // Ensure valid URL prefix
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

  const previewEl = document.getElementById('card-icon-preview');
  const previewSrc = previewEl && previewEl.tagName === 'IMG' ? previewEl.src : '';

  // Local File Upload gets priority
  let isUserIcon = false;
  if (iconFile) {
    try {
      iconUrl = await fileToBase64(iconFile);
      isUserIcon = true;
      // Add to user gallery if not already there
      if (!state.userIcons.includes(iconUrl)) {
        state.userIcons.push(iconUrl);
        saveState();
      }
    } catch (e) {
      alert('Error reading local icon file');
    }
  } else if (!iconUrl && previewSrc && previewSrc.startsWith('data:image')) {
    // If input is empty but preview has a data URL (picked from gallery), use that
    iconUrl = previewSrc;
    isUserIcon = true;
  } else if (iconUrl && (iconUrl.startsWith('data:image') || (!iconUrl.includes('icons.duckduckgo.com') && !iconUrl.startsWith('Viral icon pack/') && !iconUrl.startsWith(VIRAL_ICON_CDN)))) {
    // If user provided a manual URL or data URL that isn't a default service, mark as user icon
    isUserIcon = true;
  }

  // Use Viral icon pack if empty
  if (!iconUrl) {
    try {
      const u = new URL(url);
      let hostname = u.hostname.replace(/^www\./, '').split('.')[0].toLowerCase();

      if (typeof viralIcons !== 'undefined') {
        const exactMatch = viralIcons.find(icon => icon.toLowerCase() === `${hostname}.png`);

        if (exactMatch) {
          iconUrl = `${VIRAL_ICON_CDN}${exactMatch}`;
        } else {
          const partialMatch = viralIcons.find(icon => icon.toLowerCase().includes(hostname));
          if (partialMatch) {
            iconUrl = `${VIRAL_ICON_CDN}${partialMatch}`;
          } else {
            iconUrl = `https://icons.duckduckgo.com/ip3/${u.hostname}.ico`;
          }
        }
      } else {
        iconUrl = `https://icons.duckduckgo.com/ip3/${u.hostname}.ico`;
      }
    } catch {
      iconUrl = '';
    }
  }

  if (editingCardId) {
    const card = state.cards[currentFolderId].find(c => c.id === editingCardId);
    card.title = title;
    card.subtitle = subtitle;
    card.url = url;
    card.icon = iconUrl;
    if (isUserIcon) card.isUserIcon = true;
    else if (card.isUserIcon && !iconUrl.startsWith('data:image')) {
      // If they cleared a custom icon or chose a default one, remove the flag
      delete card.isUserIcon;
    }
    
    // Check if the folder has changed
    if (folderId !== currentFolderId) {
      // Remove from current folder
      state.cards[currentFolderId] = state.cards[currentFolderId].filter(c => c.id !== editingCardId);
      // Add to target folder
      if (!state.cards[folderId]) state.cards[folderId] = [];
      state.cards[folderId].push(card);
    }
  } else {
    const newCard = {
      id: 'c_' + generateId(),
      title,
      subtitle,
      url,
      icon: iconUrl
    };
    if (isUserIcon) newCard.isUserIcon = true;
    // Use selected folderId instead of currentFolderId for new cards too
    if (!state.cards[folderId]) state.cards[folderId] = [];
    state.cards[folderId].push(newCard);
    
    // If we added to a different folder, maybe we should switch to it?
    // For now let's just keep the current view but update state
  }

  saveState();
  renderFolders(); // Refresh counts in sidebar
  renderCards(currentFolderId);
  closeModal('card-modal');

  // AI Subtitle Generation: if subtitle is empty and API key is configured
  if (!subtitle && state.settings.openRouterKey) {
    // Find the card we just saved/created
    const targetCards = state.cards[folderId] || [];
    const targetCard = editingCardId
      ? targetCards.find(c => c.id === editingCardId)
      : targetCards[targetCards.length - 1];

    if (targetCard) {
      // Add loading indicator to the card element
      const cardEl = document.querySelector(`.card[data-id="${targetCard.id}"]`);
      if (cardEl) cardEl.classList.add('ai-loading');

      generateAISubtitle(url, title).then(aiSubtitle => {
        if (aiSubtitle) {
          targetCard.subtitle = aiSubtitle;
          saveState();
          renderCards(currentFolderId);
        } else {
          // Remove loading indicator if AI failed
          const el = document.querySelector(`.card[data-id="${targetCard.id}"]`);
          if (el) el.classList.remove('ai-loading');
        }
      });
    }
  }
}

function deleteCard() {
  if (confirm('Delete this shortcut?')) {
    state.cards[currentFolderId] = state.cards[currentFolderId].filter(c => c.id !== editingCardId);
    saveState();
    renderCards(currentFolderId);
    closeModal('card-modal');
  }
}

// SETTINGS MODAL
function openSettingsModal() {
  const bgInput = document.getElementById('bg-url-input');
  const bgFile = document.getElementById('bg-url-file');
  const bgModeSelect = document.getElementById('bg-mode-select');
  const unsplashTagInput = document.getElementById('unsplash-tag-input');
  const bgFitSelect = document.getElementById('bg-fit-select');
  const engineSelect = document.getElementById('search-engine-select');
  const foldEnable = document.getElementById('sidebar-fold-enable');
  const foldTimeout = document.getElementById('sidebar-fold-timeout');
  const foldWrapper = document.getElementById('fold-timeout-wrapper');

  // Populate values
  bgModeSelect.value = state.settings.bgMode || 'static';
  unsplashTagInput.value = state.settings.unsplashTag || '';
  bgFitSelect.value = state.settings.bgFit || 'cover';
  bgInput.value = (state.settings.bgUrl && state.settings.bgUrl.startsWith('data:image')) ? '' : (state.settings.bgUrl || '');
  bgFile.value = ''; 
  engineSelect.value = state.settings.searchEngine || 'google';
  foldEnable.checked = !!state.settings.sidebarFold;
  foldTimeout.value = state.settings.sidebarFoldTimeout || 30;
  foldWrapper.style.display = foldEnable.checked ? 'flex' : 'none';

  // Weather Settings
  document.getElementById('weather-lat').value = state.settings.weatherLat !== undefined ? state.settings.weatherLat : 31.427796;
  document.getElementById('weather-lon').value = state.settings.weatherLon !== undefined ? state.settings.weatherLon : 31.811222;

  // AI Settings
  const aiKeyInput = document.getElementById('ai-api-key-input');
  const aiModelSelect = document.getElementById('ai-model-select');
  aiKeyInput.value = state.settings.openRouterKey || '';
  aiModelSelect.value = state.settings.aiModel || 'google/gemini-2.0-flash-001';
  updateAIStatus();

  // Initial UI toggles
  toggleSettingsVisibility();
  refreshFitPreview();
  updatePreview(state.settings.bgUrl, 'bg-icon-preview');

  openModal('settings-modal');
}

function toggleSettingsVisibility() {
  const mode = document.getElementById('bg-mode-select').value;
  document.getElementById('static-bg-settings').style.display = mode === 'static' ? 'block' : 'none';
  document.getElementById('unsplash-bg-settings').style.display = mode === 'unsplash' ? 'block' : 'none';
}

function refreshFitPreview(currentUrl) {
  const bgInput = document.getElementById('bg-url-input');
  const bgFitSelect = document.getElementById('bg-fit-select');
  const bgFitPreviewImg = document.getElementById('bg-fit-preview-img');
  const url = currentUrl || bgInput.value || state.settings.bgUrl || 'wallpaper.png';
  if (bgFitPreviewImg) {
    bgFitPreviewImg.style.backgroundSize = bgFitSelect.value;
    bgFitPreviewImg.style.backgroundImage = `url('${url}')`;
  }
}

async function applyAndSaveSettings() {
  const bgInput = document.getElementById('bg-url-input').value.trim();
  const bgFile = document.getElementById('bg-url-file').files[0];
  const bgMode = document.getElementById('bg-mode-select').value;
  const bgFit = document.getElementById('bg-fit-select').value;
  const unsplashTag = document.getElementById('unsplash-tag-input').value.trim();
  const engineSelect = document.getElementById('search-engine-select').value;
  const foldEnable = document.getElementById('sidebar-fold-enable').checked;
  const foldTimeout = parseInt(document.getElementById('sidebar-fold-timeout').value) || 30;

  let bgUrl = bgInput;
  if (bgFile) {
    try {
      bgUrl = await fileToBase64(bgFile);
      // Update preview and input so user sees it's processed
      updatePreview(bgUrl, 'bg-icon-preview');
    } catch (e) {
      console.error('Error reading image file');
    }
  }

  state.settings.bgUrl = bgUrl || state.settings.bgUrl;
  state.settings.bgMode = bgMode;
  state.settings.bgFit = bgFit;
  state.settings.unsplashTag = unsplashTag;
  state.settings.searchEngine = engineSelect;
  state.settings.sidebarFold = foldEnable;
  state.settings.sidebarFoldTimeout = foldTimeout;

  const latInput = document.getElementById('weather-lat').value;
  const lonInput = document.getElementById('weather-lon').value;
  if (latInput) state.settings.weatherLat = parseFloat(latInput);
  if (lonInput) state.settings.weatherLon = parseFloat(lonInput);

  saveState();
  applySettings();
  fetchWeather(); // Refresh weather on save
}

// ICON PICKER MODAL
function openIconPicker() {
  document.getElementById('icon-search-input').value = '';
  document.getElementById('tab-viral').classList.add('active');
  document.getElementById('tab-gallery').classList.remove('active');
  renderIconPickerGrid();
  openModal('icon-picker-modal');
  document.getElementById('icon-search-input').focus();
}

let activeIconTab = 'viral';

function renderIconPickerGrid(searchTerm = '') {
  const grid = document.getElementById('icon-picker-grid');
  const searchInput = document.getElementById('icon-search-input');
  const term = searchTerm.toLowerCase().trim();

  if (activeIconTab === 'viral') {
    searchInput.style.display = 'block';
    
    // Filter icons based on search term
    const searchWords = term.split(/[\s_]+/).filter(w => w.length > 0);
    const matchedIcons = viralIcons.filter(icon => {
      if (searchWords.length === 0) return true;
      const cleanIcon = icon.toLowerCase().replace('.png', '');
      return searchWords.every(word => cleanIcon.includes(word));
    });

    const iconsToShow = matchedIcons.slice(0, 100);
    if (iconsToShow.length === 0) {
      grid.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: rgba(255,255,255,0.5);">No match found in viral icons.</p>';
      return;
    }

    grid.innerHTML = iconsToShow.map(icon => {
      const iconName = icon.replace('.png', '').replace(/_/g, ' ');
      return `
        <div class="icon-item" data-path="${VIRAL_ICON_CDN}${icon}">
          <img src="${VIRAL_ICON_CDN}${icon}" alt="${iconName}" loading="lazy">
          <span>${iconName}</span>
        </div>
      `;
    }).join('');
  } else {
    // Gallery View
    searchInput.style.display = 'none'; // No search for gallery yet to keep it simple
    if (!state.userIcons || state.userIcons.length === 0) {
      grid.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: rgba(255,255,255,0.5);">No previously uploaded icons.</p>';
      return;
    }

    grid.innerHTML = state.userIcons.map((url, idx) => {
      return `
        <div class="icon-item" data-path="${url}">
          <img src="${url}" alt="User Icon ${idx + 1}" loading="lazy">
          <span>Custom ${idx + 1}</span>
        </div>
      `;
    }).join('');
  }

  // Add click listeners to the items
  grid.querySelectorAll('.icon-item').forEach(item => {
    item.addEventListener('click', () => {
      const path = item.dataset.path;
      document.getElementById('card-icon-input').value = path.startsWith('data:image') ? '' : path;
      updatePreview(path, 'card-icon-preview');
      closeModal('icon-picker-modal');
    });
  });
}

// Tab Listeners for Icon Picker
document.getElementById('tab-viral')?.addEventListener('click', () => {
  activeIconTab = 'viral';
  document.getElementById('tab-viral').classList.add('active');
  document.getElementById('tab-gallery').classList.remove('active');
  renderIconPickerGrid();
});

document.getElementById('tab-gallery')?.addEventListener('click', () => {
  activeIconTab = 'gallery';
  document.getElementById('tab-gallery').classList.add('active');
  document.getElementById('tab-viral').classList.remove('active');
  renderIconPickerGrid();
});

// BACKUP & RESTORE MODAL
function exportBackup() {
  const dataStr = JSON.stringify(state, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `new_tab_backup_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importBackup(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const importedState = JSON.parse(event.target.result);

      // Basic validation
      if (importedState && typeof importedState === 'object' && importedState.folders && importedState.cards) {
        state = importedState;
        saveState();

        // Re-initialize UI
        applySettings();
        if (state.folders.length > 0) {
          currentFolderId = state.folders[0].id;
        } else {
          currentFolderId = null;
        }
        renderFolders();
        renderCards(currentFolderId);

        closeModal('settings-modal');
        alert('Backup restored successfully!');
      } else {
        alert('Invalid backup file format.');
      }
    } catch (err) {
      alert('Error reading backup file.');
      console.error(err);
    }
    // Reset file input so the same file can be selected again
    e.target.value = '';
  };
  reader.readAsText(file);
}

// HELPER
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
}

// SIDEBAR FOLD LOGIC
let sidebarFoldTimeoutId = null;

function resetSidebarFoldTimer() {
  if (!state.settings || !state.settings.sidebarFold) {
    if (sidebarFoldTimeoutId) clearTimeout(sidebarFoldTimeoutId);
    return;
  }
  
  if (sidebarFoldTimeoutId) clearTimeout(sidebarFoldTimeoutId);
  
  const timeoutMs = (state.settings.sidebarFoldTimeout || 30) * 1000;
  
  sidebarFoldTimeoutId = setTimeout(() => {
    foldAllCategories();
  }, timeoutMs);
}

function foldAllCategories() {
  if (!state.collapsedCategories) state.collapsedCategories = {};
  
  let changed = false;
  state.categories.forEach(cat => {
    if (!state.collapsedCategories[cat]) {
      state.collapsedCategories[cat] = true;
      changed = true;
    }
  });

  if (changed) {
    saveState();
    renderFolders();
  }
}

function showSidebarNotification(message) {
  const notification = document.getElementById('sidebar-notification');
  if (!notification) return;
  
  notification.textContent = message;
  notification.style.display = 'block';
  
  // Auto-hide after 3 seconds
  setTimeout(() => {
    notification.style.display = 'none';
  }, 3000);
}

function fetchUnsplashImage() {
  const tag = state.settings.unsplashTag || 'cyberpunk';
  // LoremFlickr is often more reliable than Unsplash's direct redirect without an API key
  const url = `https://loremflickr.com/1920/1080/${encodeURIComponent(tag)}?random=${Date.now()}`;
  const bgLayer = document.getElementById('bg-layer');
  if (bgLayer) {
    bgLayer.style.backgroundImage = `url('${url}')`;
  }
}

function initAuraBackground() {
  const container = document.getElementById('aura-container');
  if (!container) return;
  
  // Only initialize if container is empty to avoid restarting animations
  if (container.children.length > 0) return;

  const colors = [
    '#ff9d00', // Neon Orange
    '#ff4757', // Neon Red
    '#5352ed', // Neon Blue
    '#2ed573'  // Neon Green
  ];

  for (let i = 0; i < 5; i++) {
    const blob = document.createElement('div');
    blob.className = 'aura-blob';
    
    const size = 400 + Math.random() * 500;
    const duration = 15 + Math.random() * 25;
    const tx = -300 + Math.random() * 600;
    const ty = -300 + Math.random() * 600;

    blob.style.width = `${size}px`;
    blob.style.height = `${size}px`;
    blob.style.left = `${Math.random() * 80}%`;
    blob.style.top = `${Math.random() * 80}%`;
    blob.style.background = `radial-gradient(circle, ${colors[i % colors.length]}, transparent)`;
    
    // Explicitly set the animation properties
    blob.style.setProperty('--tx', `${tx}px`);
    blob.style.setProperty('--ty', `${ty}px`);
    blob.style.animationDuration = `${duration}s`;

    container.appendChild(blob);
  }
}


// --- WEATHER WIDGET ---
async function fetchWeather() {
  const lat = state.settings.weatherLat || 31.427796;
  const lon = state.settings.weatherLon || 31.811222;
  const tempEl = document.getElementById('weather-temp');
  const descEl = document.getElementById('weather-desc');
  const iconEl = document.getElementById('weather-icon');
  
  if (!tempEl) return;
  
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
    const data = await res.json();
    const w = data.current_weather;
    
    tempEl.textContent = `${Math.round(w.temperature)}°C`;
    
    // Map WMO code to description and emoji
    const wmo = {
      0: ['Clear', '☀️'],
      1: ['Mostly Clear', '🌤️'],
      2: ['Partly Cloudy', '⛅'],
      3: ['Overcast', '☁️'],
      45: ['Fog', '🌫️'],
      48: ['Rime Fog', '🌫️'],
      51: ['Light Drizzle', '🌧️'],
      53: ['Drizzle', '🌧️'],
      55: ['Heavy Drizzle', '🌧️'],
      61: ['Light Rain', '🌦️'],
      63: ['Rain', '🌧️'],
      65: ['Heavy Rain', '⛈️'],
      71: ['Light Snow', '🌨️'],
      73: ['Snow', '❄️'],
      75: ['Heavy Snow', '❄️'],
      95: ['Thunderstorm', '⛈️']
    };
    
    const status = wmo[w.weathercode] || ['Unknown', '🌥️'];
    descEl.textContent = status[0];
    iconEl.textContent = status[1];
    
    document.getElementById('weather-widget').onclick = () => {
      window.open(`https://meteum.ai/weather/en?utm_campaign=suggest&utm_medium=drp&utm_source=distrib&clid=3721391&lat=${lat}&lon=${lon}`, "_blank");
    };
  } catch (err) {
    console.error('Weather fetch error:', err);
    descEl.textContent = "Offline";
  }
}

// --- GOOGLE DRIVE SYNC ---
async function getDriveAuthToken() {
  return new Promise((resolve, reject) => {
    if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
      return reject(new Error('Chrome Runtime API not found'));
    }
    chrome.runtime.sendMessage({ action: 'getAuthToken' }, response => {
      if (chrome.runtime.lastError) {
         return reject(new Error(chrome.runtime.lastError.message));
      }
      if (response && response.error) {
         return reject(new Error(response.error));
      }
      if (response && response.token) {
         resolve(response.token);
      } else {
         reject(new Error("Unknown error obtaining token"));
      }
    });
  });
}

async function uploadToGDrive() {
  const statusEl = document.getElementById('gdrive-status');
  statusEl.innerHTML = '<span style="color: rgb(255, 157, 0);">Connecting to Google Drive...</span>';
  
  try {
    const token = await getDriveAuthToken();
    if (!token) throw new Error('Failed to obtain Auth token');
    
    statusEl.innerHTML = '<span style="color: rgb(255, 157, 0);">Uploading backup...</span>';
    
    // 1. Search for existing file in appDataFolder
    const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${encodeURIComponent('name="new_tab_sync.json"')}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const searchData = await searchRes.json();
    let fileId = searchData.files && searchData.files.length > 0 ? searchData.files[0].id : null;
    
    const fileContent = JSON.stringify(state, null, 2);
    const metadata = { name: 'new_tab_sync.json' };
    if (!fileId) metadata.parents = ['appDataFolder'];
    
    const boundary = '-------314159265358979323846';
    const delimiter = "\r\n--" + boundary + "\r\n";
    const close_delim = "\r\n--" + boundary + "--";
    
    let multipartRequestBody =
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        fileContent +
        close_delim;
        
    let url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
    let method = 'POST';
    
    if (fileId) {
       url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`;
       method = 'PATCH';
    }
    
    const res = await fetch(url, {
      method: method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: multipartRequestBody
    });
    
    if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);
    
    statusEl.innerHTML = '<span style="color: #2ea44f;">Successfully backed up to Drive! ✅</span>';
    setTimeout(() => { statusEl.innerHTML = 'Ready'; }, 3000);
  } catch (err) {
    console.error('Drive upload error:', err);
    statusEl.innerHTML = `<span style="color: #ff4757;">Error: ${err.message}. Ensure Client ID is in manifest.</span>`;
  }
}

async function downloadFromGDrive() {
  const statusEl = document.getElementById('gdrive-status');
  statusEl.innerHTML = '<span style="color: rgb(255, 157, 0);">Connecting...</span>';
  
  try {
    const token = await getDriveAuthToken();
    statusEl.innerHTML = '<span style="color: rgb(255, 157, 0);">Searching for backup...</span>';
    
    const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${encodeURIComponent('name="new_tab_sync.json"')}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const searchData = await searchRes.json();
    
    if (!searchData.files || searchData.files.length === 0) {
       throw new Error('No backup found (new_tab_sync.json).');
    }
    
    const fileId = searchData.files[0].id;
    statusEl.innerHTML = '<span style="color: rgb(255, 157, 0);">Downloading & Applying...</span>';
    
    const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (!fileRes.ok) throw new Error('Failed to download file content.');
    
    const data = await fileRes.json();
    
    if (data && data.folders && data.cards) {
       state = data;
       saveState();
       renderFolders();
       renderCards(currentFolderId);
       statusEl.innerHTML = '<span style="color: #2ea44f;">Successfully restored! ✅</span>';
       setTimeout(() => { statusEl.innerHTML = 'Ready'; }, 3000);
    } else {
       throw new Error('Invalid backup file format.');
    }
    
  } catch (err) {
    console.error('Drive download error:', err);
    statusEl.innerHTML = `<span style="color: #ff4757;">Error: ${err.message}</span>`;
  }
}
