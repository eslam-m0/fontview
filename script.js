document.addEventListener('DOMContentLoaded', () => {
    // جلب العناصر من الواجهة
    const fontInput = document.getElementById('fontInput');
    const fontContainer = document.getElementById('fontContainer');
    const previewText = document.getElementById('previewText');
    const searchFont = document.getElementById('searchFont'); // خانة البحث
    const fontSizeSlider = document.getElementById('fontSizeSlider');
    const fontSizeDisplay = document.getElementById('fontSizeDisplay');
    const alignBtns = document.querySelectorAll('.align-btn');
    const clearBtn = document.getElementById('clearBtn');
    const themeToggle = document.getElementById('themeToggle');
    const langToggle = document.getElementById('langToggle');
    const fileCount = document.getElementById('fileCount');
    const btnFolder = document.getElementById('btnFolder');
    const loadingObserver = document.getElementById('loadingObserver'); // العنصر الوهمي للمراقبة

    // القاموس
    const dict = {
        en: {
            folderBtn: "Select Font Folder",
            noFiles: "0 files selected",
            filesSelected: "files selected",
            previewLabel: "Preview Text:",
            searchLabel: "Search Fonts:",
            clear: "Clear All",
            size: "Size:",
            placeholder: "Type something to preview...",
            searchPlaceholder: "Search by name...",
            loading: "Loading more fonts..."
        },
        ar: {
            folderBtn: "اختر مجلد الخطوط",
            noFiles: "لم يتم اختيار ملفات",
            filesSelected: "ملف تم اختياره",
            previewLabel: "نص المعاينة:",
            searchLabel: "البحث عن خط:",
            clear: "مسح الكل",
            size: "الحجم:",
            placeholder: "اكتب شيئاً للمعاينة...",
            searchPlaceholder: "ابحث بالاسم...",
            loading: "جاري تحميل المزيد..."
        }
    };

    // المتغيرات لعملية التحميل المتدرج (Lazy Load) والبيانات
    let currentLang = 'en';
    let currentAlign = 'left';
    let allFontFiles = [];     // سيخزن كل الملفات المختارة
    let filteredFiles = [];    // سيخزن الملفات المطابقة للبحث
    let currentRenderIndex = 0; // لتعقب كم ملف تم رسمه
    const batchSize = 30;       // عدد الخطوط التي ترسم في كل دفعة
    let createdObjectUrls = []; // لتنظيف الذاكرة

    // 1. تغيير اللغة
    langToggle.addEventListener('click', () => {
        currentLang = currentLang === 'en' ? 'ar' : 'en';
        document.documentElement.lang = currentLang;
        document.documentElement.dir = currentLang === 'en' ? 'ltr' : 'rtl';
        
        btnFolder.textContent = dict[currentLang].folderBtn;
        document.getElementById('lblText').textContent = dict[currentLang].previewLabel;
        document.getElementById('lblSearch').textContent = dict[currentLang].searchLabel;
        document.getElementById('lblSize').textContent = dict[currentLang].size;
        clearBtn.textContent = dict[currentLang].clear;
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

    // 2. تغيير المظهر
    themeToggle.addEventListener('click', () => {
        const isDark = document.body.getAttribute('data-theme') === 'dark';
        document.body.setAttribute('data-theme', isDark ? 'light' : 'dark');
        themeToggle.textContent = isDark ? '🌙' : '☀️';
    });

    // 3. تنظيف الذاكرة الواجهة
    function cleanupMemory() {
        // حذف الروابط المؤقتة من الذاكرة لعدم استنزاف الرامات
        createdObjectUrls.forEach(url => URL.revokeObjectURL(url));
        createdObjectUrls = [];
        fontContainer.innerHTML = '';
        currentRenderIndex = 0;
        loadingObserver.textContent = '';
    }

    // 4. قراءة الخطوط وحفظها في المصفوفة (بدون رسمها)
    fontInput.addEventListener('change', (e) => {
        cleanupMemory();
        
        // جلب الملفات وتصفيتها
        const files = Array.from(e.target.files).filter(file => 
            file.name.match(/\.(ttf|otf|woff|woff2)$/i)
        );

        allFontFiles = files;
        filteredFiles = files; // في البداية، كل الملفات تظهر
        searchFont.value = ''; // تصفير البحث
        
        updateFileCountDisplay();

        // رسم أول دفعة فقط
        renderNextBatch();
    });

    // 5. محرك البحث (يتم تنفيذه عند الكتابة)
    searchFont.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        cleanupMemory();
        
        // فلترة المصفوفة
        filteredFiles = allFontFiles.filter(file => 
            file.name.toLowerCase().includes(searchTerm)
        );

        // رسم الدفعة الأولى من النتائج المفلترة
        renderNextBatch();
    });

    // 6. دالة رسم دفعة من الخطوط (Lazy Loading)
    function renderNextBatch() {
        if (currentRenderIndex >= filteredFiles.length) {
            loadingObserver.textContent = ''; // انتهت الخطوط
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
            createdObjectUrls.push(fontUrl); // حفظ الرابط لتنظيفه لاحقاً
            
            const fontFace = new FontFace(safeFontFamily, `url(${fontUrl})`);
            
            fontFace.load().then((loadedFace) => {
                document.fonts.add(loadedFace);
                createFontCard(safeFontFamily, displayName, format);
            }).catch(error => {
                // تجاهل بصمت الملفات التالفة لكي لا توقف البرنامج
            });
        });

        currentRenderIndex = endIndex;
        
        if (currentRenderIndex >= filteredFiles.length) {
            loadingObserver.textContent = '';
        }
    }

    // 7. إعداد المراقب (Observer) للتمرير التلقائي
    const observer = new IntersectionObserver((entries) => {
        // إذا ظهر العنصر الوهمي في الشاشة وكان هناك ملفات متبقية، قم برسم الدفعة التالية
        if (entries[0].isIntersecting && filteredFiles.length > 0 && currentRenderIndex < filteredFiles.length) {
            renderNextBatch();
        }
    }, { rootMargin: '100px' }); // استدعاء الدالة قبل الوصول للنهاية بـ 100 بكسل لسلاسة التمرير

    observer.observe(loadingObserver);

    // 8. إنشاء بطاقة الخط
    function createFontCard(safeFontFamily, displayName, format) {
        const card = document.createElement('div');
        card.className = 'font-card';
        
        const copyIcon = `<svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>`;

        card.innerHTML = `
            <div class="card-header">
                <div class="font-info">
                    <span class="font-name">${displayName}</span>
                    <span class="badge">${format}</span>
                </div>
                <button class="copy-btn" onclick="copyFontName('${displayName}', this)">
                    ${copyIcon} <span>Copy</span>
                </button>
            </div>
            <div class="font-preview" style="font-family: '${safeFontFamily}', sans-serif; font-size: ${fontSizeSlider.value}px; text-align: ${currentAlign};">
                ${previewText.value || previewText.placeholder}
            </div>
        `;
        fontContainer.appendChild(card);
    }

    // 9. التحديثات (النص، الحجم، المحاذاة)
    function updatePreviews() {
        const text = previewText.value || previewText.placeholder;
        const size = fontSizeSlider.value;
        document.querySelectorAll('.font-preview').forEach(preview => {
            preview.textContent = text;
            preview.style.fontSize = `${size}px`;
            preview.style.textAlign = currentAlign;
        });
    }

    previewText.addEventListener('input', updatePreviews);
    fontSizeSlider.addEventListener('input', (e) => {
        fontSizeDisplay.textContent = `${e.target.value}px`;
        updatePreviews();
    });

    alignBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            alignBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentAlign = e.target.dataset.align;
            updatePreviews();
        });
    });

    // 10. مسح الكل
    clearBtn.addEventListener('click', () => {
        cleanupMemory();
        fontInput.value = '';
        searchFont.value = '';
        allFontFiles = [];
        filteredFiles = [];
        updateFileCountDisplay();
    });

    // 11. دالة النسخ
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