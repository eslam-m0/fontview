// تفعيل الـ PWA
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
    const exportFavBtn = document.getElementById('exportFavBtn');
    const themeToggle = document.getElementById('themeToggle');
    const langToggle = document.getElementById('langToggle');
    const fileCount = document.getElementById('fileCount');
    const btnFolder = document.getElementById('btnFolder');
    const loadingObserver = document.getElementById('loadingObserver');
    const tabBtns = document.querySelectorAll('.tab-btn');

    const dict = {
        en: {
            folderBtn: "Select Font Folder", noFiles: "0 files selected", filesSelected: "files selected",
            previewLabel: "Preview Text:", searchLabel: "Search Fonts:", clear: "Clear All",
            size: "Size:", spacing: "Spacing:", height: "Line H:", textCol: "Text Color", bgCol: "Bg Color",
            placeholder: "Type something to preview...", searchPlaceholder: "Search by name...", loading: "Loading more...",
            tabAll: "All Fonts", tabFav: "Favorites ⭐", exportFav: "📥 Export Favs"
        },
        ar: {
            folderBtn: "اختر مجلد الخطوط", noFiles: "لم يتم اختيار ملفات", filesSelected: "ملف تم اختياره",
            previewLabel: "نص المعاينة:", searchLabel: "البحث عن خط:", clear: "مسح الكل",
            size: "الحجم:", spacing: "التباعد:", height: "السطر:", textCol: "لون النص", bgCol: "الخلفية",
            placeholder: "اكتب شيئاً للمعاينة...", searchPlaceholder: "ابحث بالاسم...", loading: "جاري تحميل المزيد...",
            tabAll: "كل الخطوط", tabFav: "المفضلة ⭐", exportFav: "📥 تصدير المفضلة"
        }
    };

    let currentLang = 'en';
    let currentAlign = 'left';
    let currentTab = 'all'; // all or fav
    let favoriteFonts = new Set(); // مصفوفة المفضلة
    let allFontFiles = [];     
    let filteredFiles = [];    
    let currentRenderIndex = 0; 
    const batchSize = 30;       
    let createdObjectUrls = []; 

    // الفلترة الشاملة (البحث + التبويبات)
    function applyFilters() {
        const searchTerm = searchFont.value.toLowerCase();
        filteredFiles = allFontFiles.filter(file => {
            const displayName = file.name.split('.').slice(0, -1).join('.');
            const matchesSearch = file.name.toLowerCase().includes(searchTerm);
            const matchesTab = currentTab === 'all' || favoriteFonts.has(displayName);
            return matchesSearch && matchesTab;
        });
        cleanupMemory();
        renderNextBatch();
    }

    // التبديل بين التبويبات
    tabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            tabBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentTab = e.target.dataset.tab;
            exportFavBtn.style.display = currentTab === 'fav' ? 'inline-block' : 'none';
            applyFilters();
        });
    });

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
        document.getElementById('tabAll').textContent = dict[currentLang].tabAll;
        document.getElementById('tabFav').textContent = dict[currentLang].tabFav;
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
        if (allFontFiles.length === 0) {
            fileCount.textContent = dict[currentLang].noFiles;
        } else {
            fileCount.textContent = `${allFontFiles.length} ${dict[currentLang].filesSelected}`;
        }
    }

    themeToggle.addEventListener('click', () => {
        const isDark = document.body.getAttribute('data-theme') === 'dark';
        document.body.setAttribute('data-theme', isDark ? 'light' : 'dark');
        themeToggle.textContent = isDark ? '🌙' : '☀️';
        
        // تغيير ألوان المعاينة الافتراضية لتناسب המود الجديد
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
        allFontFiles = Array.from(e.target.files).filter(file => 
            file.name.match(/\.(ttf|otf|woff|woff2)$/i)
        );
        updateFileCountDisplay();
        applyFilters();
    });

    searchFont.addEventListener('input', applyFilters);

    function renderNextBatch() {
        if (currentRenderIndex >= filteredFiles.length) {
            loadingObserver.textContent = '';
            return;
        }

        loadingObserver.textContent = dict[currentLang].loading;
        const endIndex = Math.min(currentRenderIndex + batchSize, filteredFiles.length);
        const filesToRender = filteredFiles.slice(currentRenderIndex, endIndex);

        filesToRender.forEach((file, idx) => {
            const displayName = file.name.split('.').slice(0, -1).join('.');
            const format = file.name.split('.').pop().toUpperCase();
            
            const safeFontFamily = `CustomFont_${currentRenderIndex + idx}_${Math.random().toString(36).substr(2, 5)}`;
            const fontUrl = URL.createObjectURL(file);
            createdObjectUrls.push(fontUrl); 
            
            const fontFace = new FontFace(safeFontFamily, `url(${fontUrl})`);
            
            fontFace.load().then((loadedFace) => {
                document.fonts.add(loadedFace);
                createFontCard(safeFontFamily, displayName, format);
            }).catch(() => {});
        });

        currentRenderIndex = endIndex;
        if (currentRenderIndex >= filteredFiles.length) {
            loadingObserver.textContent = '';
        }
    }

    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && filteredFiles.length > 0 && currentRenderIndex < filteredFiles.length) {
            renderNextBatch();
        }
    }, { rootMargin: '100px' }); 

    observer.observe(loadingObserver);

    function createFontCard(safeFontFamily, displayName, format) {
        const card = document.createElement('div');
        card.className = 'font-card';
        const isFav = favoriteFonts.has(displayName) ? 'active' : '';
        const copyIcon = `<svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>`;

        card.innerHTML = `
            <div class="card-header">
                <div class="font-info">
                    <span class="font-name">${displayName}</span>
                    <span class="badge">${format}</span>
                </div>
                <div class="card-actions">
                    <button class="fav-btn ${isFav}" onclick="toggleFavorite('${displayName}', this)" title="Add to Favorites">⭐</button>
                    <button class="copy-btn" onclick="copyFontName('${displayName}', this)">
                        ${copyIcon} <span>Copy</span>
                    </button>
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

    // دالة تحديث كل خصائص العرض
    function updatePreviews() {
        const text = previewText.value || previewText.placeholder;
        const size = fontSizeSlider.value;
        const spacing = letterSpacingSlider.value;
        const lineHeight = lineHeightSlider.value;
        const txtColor = textColorPicker.value;
        const bgColor = bgColorPicker.value;

        document.querySelectorAll('.font-preview').forEach(preview => {
            preview.textContent = text;
            preview.style.fontSize = `${size}px`;
            preview.style.textAlign = currentAlign;
            preview.style.letterSpacing = `${spacing}px`;
            preview.style.lineHeight = lineHeight;
            preview.style.color = txtColor;
        });

        document.querySelectorAll('.preview-container').forEach(container => {
            container.style.backgroundColor = bgColor;
        });
    }

    // مراقبة المدخلات
    previewText.addEventListener('input', updatePreviews);
    fontSizeSlider.addEventListener('input', (e) => {
        document.getElementById('fontSizeDisplay').textContent = `${e.target.value}px`;
        updatePreviews();
    });
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

    // التحكم في المفضلة
    window.toggleFavorite = function(name, btn) {
        if (favoriteFonts.has(name)) {
            favoriteFonts.delete(name);
            btn.classList.remove('active');
            if (currentTab === 'fav') {
                btn.closest('.font-card').style.display = 'none';
            }
        } else {
            favoriteFonts.add(name);
            btn.classList.add('active');
        }
    };

    // تصدير المفضلة إلى ملف نصي
    exportFavBtn.addEventListener('click', () => {
        if (favoriteFonts.size === 0) {
            alert(currentLang === 'ar' ? 'لا يوجد خطوط في المفضلة لتصديرها!' : 'No favorite fonts to export!');
            return;
        }
        const textData = Array.from(favoriteFonts).join('\n');
        const blob = new Blob([textData], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Fontview_Favorites.txt';
        a.click();
        URL.revokeObjectURL(url);
    });

    clearBtn.addEventListener('click', () => {
        cleanupMemory();
        fontInput.value = ''; searchFont.value = '';
        allFontFiles = []; filteredFiles = []; favoriteFonts.clear();
        updateFileCountDisplay();
    });

    window.copyFontName = function(name, btn) {
        navigator.clipboard.writeText(name).then(() => {
            const originalHtml = btn.innerHTML;
            btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> <span>Copied!</span>`;
            btn.style.color = 'var(--accent-color)';
            setTimeout(() => {
                btn.innerHTML = originalHtml;
                btn.style.color = '';
            }, 2000);
        });
    };
});