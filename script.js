// تسجيل الـ PWA للعمل بدون إنترنت
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('PWA SW registered!'))
      .catch(err => console.error('PWA SW failed', err));
}

document.addEventListener('DOMContentLoaded', () => {
    const fontInput = document.getElementById('fontInput');
    const fontContainer = document.getElementById('fontContainer');
    const previewText = document.getElementById('previewText');
    const searchFont = document.getElementById('searchFont'); 
    const fontSizeSlider = document.getElementById('fontSizeSlider');
    const letterSpacingSlider = document.getElementById('letterSpacingSlider');
    const lineHeightSlider = document.getElementById('lineHeightSlider');
    const textColorPicker = document.getElementById('textColorPicker');
    const bgColorPicker = document.getElementById('bgColorPicker');
    const alignBtns = document.querySelectorAll('.align-btn');
    const clearBtn = document.getElementById('clearBtn');
    const themeToggle = document.getElementById('themeToggle');
    const langToggle = document.getElementById('langToggle');
    const fileCount = document.getElementById('fileCount');
    const btnFolder = document.getElementById('btnFolder');
    const loadingObserver = document.getElementById('loadingObserver');
    const installAppBtn = document.getElementById('installAppBtn');
    
    // متغيرات القائمة الجانبية
    const openFavBtn = document.getElementById('openFavBtn');
    const closeFavBtn = document.getElementById('closeFavBtn');
    const favSidebar = document.getElementById('favSidebar');
    const favList = document.getElementById('favList');
    const exportFavBtn = document.getElementById('exportFavBtn');

    let deferredPrompt;
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault(); deferredPrompt = e;
        installAppBtn.style.display = 'inline-block';
    });
    installAppBtn.addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') installAppBtn.style.display = 'none';
            deferredPrompt = null;
        }
    });

    const dict = {
        en: {
            folderBtn: "Select Font Folder", noFiles: "0 files selected", filesSelected: "files selected",
            previewLabel: "Preview Text:", searchLabel: "Search Fonts:", clear: "Clear All",
            size: "Size:", spacing: "Space:", height: "Line:", textCol: "Text", bgCol: "Bg",
            placeholder: "Type something...", searchPlaceholder: "Search by name...", loading: "Loading more...",
            favBtn: "⭐ Favorites", exportFav: "📥 Export Favs", installApp: "Install App 📱", favTitle: "Favorites ⭐"
        },
        ar: {
            folderBtn: "اختر المجلد", noFiles: "لم يتم الاختيار", filesSelected: "ملف",
            previewLabel: "نص المعاينة:", searchLabel: "البحث:", clear: "مسح الكل",
            size: "الحجم:", spacing: "التباعد:", height: "السطر:", textCol: "النص", bgCol: "الخلفية",
            placeholder: "اكتب شيئاً...", searchPlaceholder: "ابحث بالاسم...", loading: "جاري التحميل...",
            favBtn: "⭐ المفضلة", exportFav: "📥 التصدير", installApp: "تثبيت التطبيق 📱", favTitle: "المفضلة ⭐"
        }
    };

    let currentLang = 'en';
    let currentAlign = 'left';
    let allFontFiles = [];     
    let filteredFiles = [];    
    let currentRenderIndex = 0; 
    const batchSize = 30;       
    let createdObjectUrls = []; 
    
    const fontSafeNameMap = new Map(); 
    const fontFileNameMap = new Map(); // لحفظ اسم الملف الأصلي بالامتداد

    // تحميل المفضلة من ذاكرة المتصفح (Persistence)
    let savedFavs = localStorage.getItem('fontview_favorites');
    let favoriteFonts = savedFavs ? new Set(JSON.parse(savedFavs)) : new Set();
    
    // إظهار المفضلة المحفوظة عند فتح التطبيق
    updateSidebarList();

    function saveFavorites() {
        localStorage.setItem('fontview_favorites', JSON.stringify(Array.from(favoriteFonts)));
    }

    // فتح وغلق القائمة الجانبية
    openFavBtn.addEventListener('click', () => favSidebar.classList.add('open'));
    closeFavBtn.addEventListener('click', () => favSidebar.classList.remove('open'));

    function applyFilters() {
        const searchTerm = searchFont.value.toLowerCase();
        filteredFiles = allFontFiles.filter(file => file.name.toLowerCase().includes(searchTerm));
        cleanupMemory();
        renderNextBatch();
    }

    langToggle.addEventListener('click', () => {
        currentLang = currentLang === 'en' ? 'ar' : 'en';
        document.documentElement.lang = currentLang;
        document.documentElement.dir = currentLang === 'en' ? 'ltr' : 'rtl';
        
        btnFolder.textContent = dict[currentLang].folderBtn;
        document.getElementById('lblText').textContent = dict[currentLang].previewLabel;
        document.getElementById('lblSearch').textContent = dict[currentLang].searchLabel;
        document.getElementById('lblSize').textContent = dict[currentLang].size;
        document.getElementById('lblSpacing').textContent = dict[currentLang].spacing;
        document.getElementById('lblLineHeight').textContent = dict[currentLang].height;
        document.getElementById('lblTextColor').textContent = dict[currentLang].textCol;
        document.getElementById('lblBgColor').textContent = dict[currentLang].bgCol;
        clearBtn.textContent = dict[currentLang].clear;
        exportFavBtn.textContent = dict[currentLang].exportFav;
        openFavBtn.textContent = dict[currentLang].favBtn;
        document.getElementById('lblSidebarTitle').textContent = dict[currentLang].favTitle;
        installAppBtn.textContent = dict[currentLang].installApp;
        previewText.placeholder = dict[currentLang].placeholder;
        searchFont.placeholder = dict[currentLang].searchPlaceholder;
        langToggle.textContent = currentLang === 'en' ? 'عربي' : 'English';
        
        updateFileCountDisplay();
        currentAlign = currentLang === 'en' ? 'left' : 'right';
        alignBtns.forEach(b => b.classList.remove('active'));
        document.querySelector(`[data-align="${currentAlign}"]`).classList.add('active');
        updatePreviews();
    });

    function updateFileCountDisplay() {
        fileCount.textContent = allFontFiles.length === 0 ? dict[currentLang].noFiles : `${allFontFiles.length} ${dict[currentLang].filesSelected}`;
    }

    themeToggle.addEventListener('click', () => {
        const isDark = document.body.getAttribute('data-theme') === 'dark';
        document.body.setAttribute('data-theme', isDark ? 'light' : 'dark');
        themeToggle.textContent = isDark ? '🌙' : '☀️';
        bgColorPicker.value = isDark ? '#ffffff' : '#1e1e1e';
        textColorPicker.value = isDark ? '#121212' : '#ffffff';
        updatePreviews();
    });

    function cleanupMemory() {
        createdObjectUrls.forEach(url => URL.revokeObjectURL(url));
        createdObjectUrls = [];
        fontContainer.innerHTML = '';
        currentRenderIndex = 0;
        loadingObserver.textContent = '';
    }

    fontInput.addEventListener('change', (e) => {
        allFontFiles = Array.from(e.target.files).filter(file => file.name.match(/\.(ttf|otf|woff|woff2)$/i));
        fontSafeNameMap.clear();
        fontFileNameMap.clear();
        updateFileCountDisplay();
        applyFilters();
    });

    searchFont.addEventListener('input', applyFilters);

    function renderNextBatch() {
        if (currentRenderIndex >= filteredFiles.length) { loadingObserver.textContent = ''; return; }
        loadingObserver.textContent = dict[currentLang].loading;
        const endIndex = Math.min(currentRenderIndex + batchSize, filteredFiles.length);
        const filesToRender = filteredFiles.slice(currentRenderIndex, endIndex);

        filesToRender.forEach((file, idx) => {
            const displayName = file.name.split('.').slice(0, -1).join('.');
            const format = file.name.split('.').pop().toUpperCase();
            const safeFontFamily = `CustomFont_${currentRenderIndex + idx}_${Math.random().toString(36).substr(2, 5)}`;
            
            fontSafeNameMap.set(displayName, safeFontFamily); 
            fontFileNameMap.set(displayName, file.name); // حفظ الاسم الأصلي بالامتداد
            
            const fontUrl = URL.createObjectURL(file);
            createdObjectUrls.push(fontUrl); 
            
            const fontFace = new FontFace(safeFontFamily, `url(${fontUrl})`);
            fontFace.load().then((loadedFace) => {
                document.fonts.add(loadedFace);
                createFontCard(safeFontFamily, displayName, format, file.name); // تمرير اسم الملف الأصلي
            }).catch(() => {});
        });

        currentRenderIndex = endIndex;
        if (currentRenderIndex >= filteredFiles.length) loadingObserver.textContent = '';
        
        // تحديث الخطوط في القائمة الجانبية بعد تحميل الدفعة
        updateSidebarList();
    }

    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && filteredFiles.length > 0 && currentRenderIndex < filteredFiles.length) renderNextBatch();
    }, { rootMargin: '100px' }); 
    observer.observe(loadingObserver);

    function createFontCard(safeFontFamily, displayName, format, originalFileName) {
        const card = document.createElement('div');
        card.className = 'font-card';
        const isFav = favoriteFonts.has(displayName) ? 'active' : '';
        const copyIcon = `<svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>`;

        // تم تغيير دالة النسخ لتنسخ originalFileName بدلاً من displayName
        card.innerHTML = `
            <div class="card-header">
                <div class="font-info">
                    <span class="font-name">${displayName}</span>
                    <span class="badge">${format}</span>
                </div>
                <div class="card-actions">
                    <button class="fav-btn ${isFav}" onclick="toggleFavorite('${displayName}', this)" title="Favorite">⭐</button>
                    <button class="copy-btn" onclick="copyFontName('${originalFileName}', this)">${copyIcon} Copy</button>
                </div>
            </div>
            <div class="preview-container" style="background-color: ${bgColorPicker.value};">
                <div class="font-preview" style="font-family: '${safeFontFamily}', sans-serif; font-size: ${fontSizeSlider.value}px; text-align: ${currentAlign}; color: ${textColorPicker.value}; letter-spacing: ${letterSpacingSlider.value}px; line-height: ${lineHeightSlider.value};">
                    ${previewText.value || previewText.placeholder}
                </div>
            </div>
        `;
        fontContainer.appendChild(card);
    }

    function updatePreviews() {
        const text = previewText.value || previewText.placeholder;
        const size = fontSizeSlider.value;
        const spacing = letterSpacingSlider.value;
        const lineHeight = lineHeightSlider.value;
        const txtColor = textColorPicker.value;
        const bgColor = bgColorPicker.value;

        document.querySelectorAll('.font-preview').forEach(preview => {
            preview.textContent = text; preview.style.fontSize = `${size}px`;
            preview.style.textAlign = currentAlign; preview.style.letterSpacing = `${spacing}px`;
            preview.style.lineHeight = lineHeight; preview.style.color = txtColor;
        });
        document.querySelectorAll('.preview-container').forEach(c => c.style.backgroundColor = bgColor);
    }

    previewText.addEventListener('input', updatePreviews);
    fontSizeSlider.addEventListener('input', (e) => { document.getElementById('fontSizeDisplay').textContent = `${e.target.value}px`; updatePreviews(); });
    letterSpacingSlider.addEventListener('input', updatePreviews);
    lineHeightSlider.addEventListener('input', updatePreviews);
    textColorPicker.addEventListener('input', updatePreviews);
    bgColorPicker.addEventListener('input', updatePreviews);

    alignBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            alignBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentAlign = e.target.dataset.align;
            updatePreviews();
        });
    });

    window.toggleFavorite = function(name, btn) {
        if (favoriteFonts.has(name)) {
            favoriteFonts.delete(name);
            if(btn) btn.classList.remove('active');
        } else {
            favoriteFonts.add(name);
            if(btn) btn.classList.add('active');
        }
        saveFavorites(); // حفظ التعديلات
        updateSidebarList();
    };

    function updateSidebarList() {
        favList.innerHTML = '';
        if (favoriteFonts.size === 0) {
            favList.innerHTML = `<p style="color: var(--text-secondary); text-align: center; margin-top: 20px;">No favorites yet.</p>`;
            return;
        }
        favoriteFonts.forEach(name => {
            const safeName = fontSafeNameMap.get(name) || 'sans-serif'; 
            const exactFileName = fontFileNameMap.get(name) || name; // الاسم بالامتداد
            
            const item = document.createElement('div');
            item.className = 'fav-item';
            // إضافة زر النسخ في القائمة الجانبية
            item.innerHTML = `
                <div style="font-family: '${safeName}', sans-serif; font-size: 1.1rem; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${name}">${name}</div>
                <div style="display: flex; gap: 10px; align-items: center;">
                    <button class="copy-btn" onclick="copyFontName('${exactFileName}', this)" style="border:none; background:none; cursor:pointer; color:var(--text-secondary);" title="Copy Exact Name">
                        <svg viewBox="0 0 24 24" width="18" height="18" style="fill:currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
                    </button>
                    <button class="close-sidebar" onclick="removeFavFromSidebar('${name}')" style="font-size: 1.2rem; color: #ff3b30; border:none; background:none; cursor:pointer;">✖</button>
                </div>
            `;
            favList.appendChild(item);
        });
    }

    window.removeFavFromSidebar = function(name) {
        favoriteFonts.delete(name);
        saveFavorites(); // حفظ التعديلات
        updateSidebarList();
        
        // تحديث النجمة في الواجهة الرئيسية إن كانت معروضة
        const cards = document.querySelectorAll('.font-card');
        cards.forEach(card => {
            const fontName = card.querySelector('.font-name').textContent;
            if (fontName === name) {
                card.querySelector('.fav-btn').classList.remove('active');
            }
        });
    };

    exportFavBtn.addEventListener('click', () => {
        if (favoriteFonts.size === 0) return;
        const textData = Array.from(favoriteFonts).join('\n');
        const blob = new Blob([textData], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'Fontview_Favorites.txt';
        a.click(); URL.revokeObjectURL(url);
    });

    clearBtn.addEventListener('click', () => {
        cleanupMemory();
        fontInput.value = ''; searchFont.value = '';
        allFontFiles = []; filteredFiles = []; 
        favoriteFonts.clear();
        saveFavorites(); // حذف المفضلة من الذاكرة أيضاً
        updateFileCountDisplay(); updateSidebarList();
    });

    window.copyFontName = function(name, btn) {
        navigator.clipboard.writeText(name).then(() => {
            const originalHtml = btn.innerHTML;
            btn.innerHTML = `<span>Copied!</span>`;
            btn.style.color = 'var(--accent-color)';
            setTimeout(() => { btn.innerHTML = originalHtml; btn.style.color = ''; }, 2000);
        });
    };
});