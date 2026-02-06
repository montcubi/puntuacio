// Storage keys and schema versioning for backwards-compatible migrations.
const STORAGE_KEYS = {
    classes: 'esoClassesData',
    settings: 'esoSettings',
    categories: 'esoCategories',
    legacyScores: 'esoScoresData',
};
const SCHEMA_VERSION = 1;
const nowIso = () => new Date().toISOString();
const parseJson = (raw, fallback) => {
    if (!raw) return fallback;
    try { return JSON.parse(raw); } catch { return fallback; }
};

window.app = {
            mode: 'teacher',
            classes: [],
            currentClassId: null,
            schemaVersion: SCHEMA_VERSION,
            lastModifiedAt: null,
            _escapeHtml(v) {
                const s = (v ?? '').toString();
                return s
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#39;');
            },
            _escapeAttr(v) { return this._escapeHtml(v); },
            get data() { const c = this.classes.find(cls => cls.id === this.currentClassId); return c ? c.students : []; },
            set data(newStudents) { const idx = this.classes.findIndex(cls => cls.id === this.currentClassId); if (idx !== -1) this.classes[idx].students = newStudents; },
            get currentTarget() { const c = this.classes.find(cls => cls.id === this.currentClassId); return c ? (c.targetScore || 0) : 0; },
            set currentTarget(val) { const idx = this.classes.findIndex(cls => cls.id === this.currentClassId); if (idx !== -1) this.classes[idx].targetScore = val; },
            settings: { thresholds: { as: 20, an: 40, ae: 60 } },
            categories: [],
            availableIcons: ['fa-hand-paper', 'fa-book-open', 'fa-star', 'fa-medal', 'fa-thumbs-down', 'fa-check', 'fa-comment', 'fa-pen', 'fa-calculator', 'fa-flask', 'fa-map', 'fa-brain', 'fa-lightbulb', 'fa-heart', 'fa-bolt', 'fa-clock', 'fa-triangle-exclamation', 'fa-eraser', 'fa-palette', 'fa-music'],
            colorMap: { blue: 'bg-blue-100 text-blue-700 hover:bg-blue-200', purple: 'bg-purple-100 text-purple-700 hover:bg-purple-200', green: 'bg-green-100 text-green-700 hover:bg-green-200', yellow: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200', red: 'bg-red-100 text-red-700 hover:bg-red-200', gray: 'bg-gray-100 text-gray-700 hover:bg-gray-200', pink: 'bg-pink-100 text-pink-700 hover:bg-pink-200' },

            init() {
                const now = new Date();
                const options = { year: 'numeric', month: 'long', day: 'numeric' };
                const dateEl = document.getElementById('current-date');
                if (dateEl) { dateEl.innerText = now.toLocaleDateString('ca-ES', options); }
                this.loadData();
                this.updateLegend();
                this.renderClassSelector();
                this.render();
                this.renderIconSelector();
            },

            loadData() {
                const storedCategories = localStorage.getItem(STORAGE_KEYS.categories);
                if (storedCategories) { this.categories = parseJson(storedCategories, this.categories); } else { this.categories = [{ id: 'part', label: 'Participació', points: 2, icon: 'fa-hand-paper', colorKey: 'blue', color: 'bg-blue-100 text-blue-700 hover:bg-blue-200' }, { id: 'homework', label: 'Deures Fets', points: 3, icon: 'fa-book-open', colorKey: 'purple', color: 'bg-purple-100 text-purple-700 hover:bg-purple-200' }, { id: 'opt_work', label: 'Treball Opcional', points: 5, icon: 'fa-star', colorKey: 'yellow', color: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' }, { id: 'excellence', label: 'Excel·lència', points: 4, icon: 'fa-medal', colorKey: 'green', color: 'bg-green-100 text-green-700 hover:bg-green-200' }, { id: 'attitude_bad', label: 'Falta Interès', points: -2, icon: 'fa-thumbs-down', colorKey: 'red', color: 'bg-red-100 text-red-700 hover:bg-red-200' }]; }
                const storedSettings = localStorage.getItem(STORAGE_KEYS.settings);
                if (storedSettings) { this.settings = parseJson(storedSettings, this.settings); }
                const storedClasses = localStorage.getItem(STORAGE_KEYS.classes);
                if (storedClasses) { 
                    const parsed = parseJson(storedClasses, {}); 
                    // v0 payload: { currentClassId, classes }
                    // v1 payload: { schemaVersion, lastModifiedAt, currentClassId, classes }
                    this.schemaVersion = parsed.schemaVersion || 0;
                    this.lastModifiedAt = parsed.lastModifiedAt || null;
                    this.classes = parsed.classes || []; 
                    // Ensure targetScore exists
                    this.classes.forEach(c => { if(c.targetScore === undefined) c.targetScore = 0; });
                    this.currentClassId = parsed.currentClassId || (this.classes.length > 0 ? this.classes[0].id : null); 
                } else {
                    const oldData = localStorage.getItem(STORAGE_KEYS.legacyScores);
                    if (oldData) { const students = JSON.parse(oldData); const defaultClass = { id: 'class_default', name: 'Grup Principal', students: Array.isArray(students) ? students : [], targetScore: 0 }; this.classes = [defaultClass]; this.currentClassId = defaultClass.id; this.saveData(); } else { const defaultClass = { id: 'class_1', name: '2n ESO A', students: [], targetScore: 0 }; this.classes = [defaultClass]; this.currentClassId = defaultClass.id; }
                }

                // Soft migrations: keep existing data, only add missing fields.
                this.classes.forEach(c => {
                    if (!Array.isArray(c.students)) c.students = [];
                    c.students.forEach(s => {
                        if (s.isAbsent === undefined) s.isAbsent = false;
                        if (!Array.isArray(s.history)) s.history = [];
                        if (!Array.isArray(s.actions)) s.actions = []; // stack for "undo"
                        if (typeof s.score !== 'number') s.score = parseInt(s.score || 0, 10) || 0;
                    });
                });
            },

            saveData() {
                this.schemaVersion = SCHEMA_VERSION;
                this.lastModifiedAt = nowIso();
                localStorage.setItem(STORAGE_KEYS.classes, JSON.stringify({
                    schemaVersion: this.schemaVersion,
                    lastModifiedAt: this.lastModifiedAt,
                    currentClassId: this.currentClassId,
                    classes: this.classes,
                }));
            },
            saveSettingsData() { localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(this.settings)); },
            saveCategoriesData() { localStorage.setItem(STORAGE_KEYS.categories, JSON.stringify(this.categories)); },
            resetAppData() {
                const msg =
                    "AIXO ESBORRARA TOTES LES DADES (classes, alumnes, puntuacions, ids, categories i barems) d'aquest navegador.\n\n" +
                    "Consell: fes una copia de seguretat abans (Configuracio -> Descarregar).\n\n" +
                    "Vols continuar?";
                if (!confirm(msg)) return;
                [STORAGE_KEYS.classes, STORAGE_KEYS.settings, STORAGE_KEYS.categories, STORAGE_KEYS.legacyScores].forEach(k => localStorage.removeItem(k));
                location.reload();
            },

            renderClassSelector() {
                const select = document.getElementById('classSelector');
                select.innerHTML = this.classes.map(c => {
                    const id = this._escapeAttr(c.id);
                    const name = this._escapeHtml(c.name);
                    return `<option value="${id}" ${c.id === this.currentClassId ? 'selected' : ''}>${name}</option>`;
                }).join('');
                const currentClass = this.classes.find(c => c.id === this.currentClassId);
                const title = currentClass ? currentClass.name : "Sense Classe";
                document.getElementById('list-title').innerText = title;
                document.getElementById('proj-class-title').innerText = title;
            },

            switchClass(newId) { this.currentClassId = newId; this.saveData(); this.renderClassSelector(); this.render(); },

            // --- Modals ---
            openClassModal() { this._openModal('class-modal', this.renderClassManagerList.bind(this)); },
            closeClassModal() { this._closeModal('class-modal'); },
            openIdManager() { this._openModal('id-manager-modal', this._renderIdList.bind(this)); },
            closeIdManager() { this._closeModal('id-manager-modal'); },
            openCategoryModal() { this._openModal('category-modal', () => { this.renderCategoryList(); this.resetCategoryForm(); }); },
            closeCategoryModal() { this._closeModal('category-modal', this.render.bind(this)); },
            openSettingsModal() { 
                document.getElementById('setting-as').value = this.settings.thresholds.as;
                document.getElementById('setting-an').value = this.settings.thresholds.an;
                document.getElementById('setting-ae').value = this.settings.thresholds.ae;
                this._openModal('settings-modal'); 
            },
            closeSettingsModal() { this._closeModal('settings-modal'); },
            openHelpModal() { this._openModal('help-modal'); },
            closeHelpModal() { this._closeModal('help-modal'); },
            openImportModal() {
                const className = this.classes.find(c => c.id === this.currentClassId)?.name || 'la classe';
                document.getElementById('import-class-name').innerText = className;
                document.getElementById('importTextarea').value = '';
                this._openModal('import-modal', () => document.getElementById('importTextarea').focus());
            },
            closeImportModal() { this._closeModal('import-modal'); },

            _openModal(id, callback) {
                const modal = document.getElementById(id);
                const content = document.getElementById(id + '-content');
                if(callback) callback();
                modal.classList.remove('hidden'); modal.classList.add('flex');
                setTimeout(() => { content.classList.remove('scale-95', 'opacity-0'); content.classList.add('scale-100', 'opacity-100'); }, 10);
            },
            _closeModal(id, callback) {
                const modal = document.getElementById(id);
                const content = document.getElementById(id + '-content');
                content.classList.remove('scale-100', 'opacity-100'); content.classList.add('scale-95', 'opacity-0');
                setTimeout(() => { modal.classList.add('hidden'); modal.classList.remove('flex'); if(callback) callback(); }, 200);
            },

            // --- Class Manager ---
            renderClassManagerList() {
                document.getElementById('class-list-container').innerHTML = this.classes.map(c => `
                    <div class="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-200 hover:shadow-sm transition">
                        <div class="flex-1"><span class="font-bold text-gray-800">${this._escapeHtml(c.name)}</span><div class="text-xs text-gray-500 mt-0.5">${c.students.length} alumnes</div></div>
                        <div class="flex items-center gap-1">
                            <button data-class-id="${this._escapeAttr(c.id)}" onclick="app.renameClass(this.dataset.classId)" class="p-2 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition" title="Canviar nom de la classe"><i class="fa-solid fa-pen"></i></button>
                            ${this.classes.length > 1 ? `<button data-class-id="${this._escapeAttr(c.id)}" onclick="app.deleteClass(this.dataset.classId)" class="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition" title="Eliminar classe (esborra tots els alumnes i puntuacions d'aquest grup)"><i class="fa-solid fa-trash"></i></button>` : ''}
                        </div>
                    </div>`).join('');
            },
            createClass(e) { e.preventDefault(); const name = document.getElementById('newClassName').value.trim(); if(!name) return; const newClass = { id: 'class_' + Date.now(), name: name, students: [], targetScore: 0 }; this.classes.push(newClass); this.currentClassId = newClass.id; this.saveData(); document.getElementById('newClassName').value = ''; this.renderClassManagerList(); this.renderClassSelector(); this.render(); this.showToast(`Grup "${name}" creat`, 'success'); },
            createExampleClass() {
                const label = "Classe d'exemple";
                const classId = 'class_example_' + Date.now();
                const today = new Date().toLocaleDateString('ca-ES');
                const cats = Array.isArray(this.categories) ? this.categories : [];
                const pickCat = (i) => cats.length ? cats[i % cats.length] : { label: "Participació", points: 2 };
                const mkHistory = (seed) => {
                    const h = [];
                    // 3 recent actions, newest first (like updateScore does)
                    for (let i = 0; i < 3; i++) {
                        const c = pickCat(seed + i);
                        h.unshift({ cat: c.label, pts: c.points, date: today });
                    }
                    return h.slice(0, 5).reverse(); // keep newest first (unshift)
                };

                const names = [
                    "Alumne Exemple 01",
                    "Alumne Exemple 02",
                    "Alumne Exemple 03",
                    "Alumne Exemple 04",
                    "Alumne Exemple 05",
                    "Alumne Exemple 06",
                    "Alumne Exemple 07",
                    "Alumne Exemple 08",
                    "Alumne Exemple 09",
                    "Alumne Exemple 10",
                ];
                const scores = [12, 18, 22, 27, 35, 41, 48, 55, 63, 72];

                const students = names.map((name, i) => ({
                    id: this.generateShortId(),
                    name,
                    score: scores[i] ?? 0,
                    isAbsent: i === 2, // one absent example
                    history: mkHistory(i),
                    actions: [],
                }));

                const newClass = { id: classId, name: label, students, targetScore: 60 };
                this.classes.push(newClass);
                this.currentClassId = newClass.id;
                this.saveData();
                this.renderClassManagerList();
                this.renderClassSelector();
                this.render();
                this.showToast("Classe d'exemple creada", "success");
            },
            deleteClass(id) { if(confirm("Segur que vols eliminar aquesta classe?")) { const idx = this.classes.findIndex(c => c.id === id); this.classes.splice(idx, 1); if (this.currentClassId === id) this.currentClassId = this.classes.length > 0 ? this.classes[0].id : null; this.saveData(); this.renderClassManagerList(); this.renderClassSelector(); this.render(); this.showToast('Classe eliminada', 'info'); } },
            renameClass(id) { const cls = this.classes.find(c => c.id === id); if (!cls) return; const newName = prompt("Nou nom:", cls.name); if (newName && newName.trim()) { cls.name = newName.trim(); this.saveData(); this.renderClassManagerList(); this.renderClassSelector(); this.showToast("Nom actualitzat", "success"); } },

            // --- ID Manager ---
            _renderIdList() {
                const list = document.getElementById('id-manager-list');
                const sorted = [...this.data].sort((a, b) => a.name.localeCompare(b.name));
                list.innerHTML = sorted.length ? sorted.map(s => `<tr class="hover:bg-gray-50 bg-white"><td class="px-4 py-3 font-medium text-gray-800">${this._escapeHtml(s.name)}</td><td class="px-4 py-3 text-right font-mono font-bold text-indigo-600 tracking-wider">${this._escapeHtml(s.id)}</td></tr>`).join('') : '<tr><td colspan="2" class="p-4 text-center text-gray-400">No hi ha alumnes.</td></tr>';
            },
            copyIdList() { const text = [...this.data].sort((a, b) => a.name.localeCompare(b.name)).map(s => `${s.name}\t${s.id}`).join('\n'); navigator.clipboard.writeText(text).then(() => this.showToast('Llista copiada', 'success')); },
            regenerateAllIds() { if(confirm("ATENCIÓ: Canviaràs tots els IDs.")) { this.data = this.data.map(s => ({ ...s, id: this.generateShortId() })); this.saveData(); this._renderIdList(); this.render(); this.showToast('IDs regenerats', 'success'); } },
            generateShortId() { let newId, exists = true; const all = this.classes.flatMap(c => c.students); while(exists) { newId = Math.floor(10000 + Math.random() * 90000); exists = all.some(s => s.id === newId); } return newId; },

            // --- Categories ---
            renderIconSelector() { document.getElementById('icon-selector').innerHTML = this.availableIcons.map(icon => `<div onclick="app.selectIcon('${icon}')" class="icon-option cursor-pointer p-2 rounded border border-gray-200 hover:bg-indigo-50 text-center text-gray-600" data-icon="${icon}"><i class="fa-solid ${icon}"></i></div>`).join(''); },
            selectIcon(icon) { document.getElementById('cat-icon').value = icon; document.querySelectorAll('.icon-option').forEach(el => { el.dataset.icon === icon ? el.classList.add('bg-indigo-100', 'border-indigo-500', 'text-indigo-700') : el.classList.remove('bg-indigo-100', 'border-indigo-500', 'text-indigo-700'); }); },
            renderCategoryList() { document.getElementById('category-list').innerHTML = this.categories.map((cat, idx) => `<div class="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg"><div class="flex items-center gap-3"><div class="w-8 h-8 rounded-full flex items-center justify-center text-sm ${cat.color}" title="Icona i color de l'ítem"><i class="fa-solid ${cat.icon}"></i></div><div><p class="font-bold text-sm text-gray-800">${this._escapeHtml(cat.label)}</p><p class="text-xs text-gray-500 font-mono">${cat.points > 0 ? '+' : ''}${cat.points} pts</p></div></div><div class="flex gap-1"><button onclick="app.editCategory(${idx})" class="p-1.5 text-gray-400 hover:text-indigo-600" title="Editar ítem"><i class="fa-solid fa-pen"></i></button><button onclick="app.deleteCategory(${idx})" class="p-1.5 text-gray-400 hover:text-red-600" title="Eliminar ítem"><i class="fa-solid fa-trash"></i></button></div></div>`).join(''); },
            resetCategoryForm() { document.getElementById('cat-form-title').innerText = "Afegir Nou"; document.getElementById('cat-id').value = ""; document.getElementById('cat-label').value = ""; document.getElementById('cat-points').value = ""; this.selectIcon(this.availableIcons[0]); },
            editCategory(idx) { const cat = this.categories[idx]; document.getElementById('cat-form-title').innerText = "Editar"; document.getElementById('cat-id').value = idx; document.getElementById('cat-label').value = cat.label; document.getElementById('cat-points').value = cat.points; document.getElementById('cat-color').value = cat.colorKey; this.selectIcon(cat.icon); },
            saveCategory(e) { e.preventDefault(); const idx = document.getElementById('cat-id').value; const cat = { id: idx !== "" ? this.categories[idx].id : 'cat_'+Date.now(), label: document.getElementById('cat-label').value, points: parseInt(document.getElementById('cat-points').value), icon: document.getElementById('cat-icon').value, colorKey: document.getElementById('cat-color').value, color: this.colorMap[document.getElementById('cat-color').value] }; if(idx !== "") this.categories[idx] = cat; else this.categories.push(cat); this.saveCategoriesData(); this.renderCategoryList(); this.resetCategoryForm(); this.showToast("Ítem guardat", "success"); },
            deleteCategory(idx) { if(confirm("Eliminar?")) { this.categories.splice(idx, 1); this.saveCategoriesData(); this.renderCategoryList(); this.showToast("Eliminat", "info"); } },

            // --- Settings & Backup ---
            saveSettings() { 
                const as = parseInt(document.getElementById('setting-as').value), an = parseInt(document.getElementById('setting-an').value), ae = parseInt(document.getElementById('setting-ae').value);
                if (as >= an || an >= ae) return this.showToast("Error valors (AS < AN < AE)", "error");
                this.settings.thresholds = { as, an, ae }; this.saveSettingsData(); this.updateLegend(); this.render(); this.closeSettingsModal(); this.showToast("Configuració guardada", "success");
            },
            updateLegend() { const t = this.settings.thresholds; document.getElementById('range-na').innerText = `< ${t.as}`; document.getElementById('range-as').innerText = `${t.as}-${t.an-1}`; document.getElementById('range-an').innerText = `${t.an}-${t.ae-1}`; document.getElementById('range-ae').innerText = `${t.ae}+`; },
            downloadBackup: async function () {
                const readJson = (k, fallback) => {
                    return parseJson(localStorage.getItem(k), fallback);
                };

                const backup = {
                    format: "puntuacio-backup",
                    version: 1,
                    exportedAt: new Date().toISOString(),
                    data: {
                        // Store parsed objects (not JSON strings) to make backups portable and inspectable.
                        esoClassesData: readJson(STORAGE_KEYS.classes, []),
                        esoSettings: readJson(STORAGE_KEYS.settings, null),
                        esoCategories: readJson(STORAGE_KEYS.categories, []),
                    }
                };

                const date = new Date().toISOString().split("T")[0];
                const filename = `backup_aula_${date}.json`;
                const jsonText = JSON.stringify(backup, null, 2);

                // Best UX: let the user pick a folder (works on Chromium with secure context, e.g. localhost/https).
                if (window.showSaveFilePicker) {
                    try {
                        const handle = await window.showSaveFilePicker({
                            suggestedName: filename,
                            types: [{ description: "JSON", accept: { "application/json": [".json"] } }],
                        });
                        const writable = await handle.createWritable();
                        await writable.write(jsonText);
                        await writable.close();
                        this.showToast("Còpia guardada", "success");
                        return;
                    } catch (e) {
                        // User cancelled or browser denied; fall back to download.
                    }
                }

                const blob = new Blob([jsonText], { type: "application/json" });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(a.href), 0);
                this.showToast("Còpia descarregada", "success");
            },
            restoreBackup(input) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const parsed = JSON.parse(e.target.result);

                        // New format (v1): { format, version, data: { esoClassesData, esoSettings, esoCategories } }
                        if (parsed && parsed.format === "puntuacio-backup" && parsed.data) {
                            if (parsed.data.esoClassesData != null) localStorage.setItem(STORAGE_KEYS.classes, JSON.stringify(parsed.data.esoClassesData));
                            if (parsed.data.esoSettings != null) localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(parsed.data.esoSettings));
                            if (parsed.data.esoCategories != null) localStorage.setItem(STORAGE_KEYS.categories, JSON.stringify(parsed.data.esoCategories));
                            location.reload();
                            return;
                        }

                        // Legacy format: { esoClassesData: "<json-string>", esoSettings: "<json-string>", esoCategories: "<json-string>" }
                        if (parsed && (parsed.esoClassesData || parsed.esoSettings || parsed.esoCategories)) {
                            if (parsed.esoClassesData) localStorage.setItem(STORAGE_KEYS.classes, parsed.esoClassesData);
                            if (parsed.esoSettings) localStorage.setItem(STORAGE_KEYS.settings, parsed.esoSettings);
                            if (parsed.esoCategories) localStorage.setItem(STORAGE_KEYS.categories, parsed.esoCategories);
                            location.reload();
                            return;
                        }

                        this.showToast("Backup no reconegut", "error");
                    } catch (err) {
                        this.showToast("Error fitxer", "error");
                    }
                };
                if (input.files[0]) reader.readAsText(input.files[0]);
            },
            exportToCSV() {
                const currentClass = this.classes.find(c => c.id === this.currentClassId);
                if (!currentClass) return this.showToast("Sense classe", "error");

                const esc = (v) => {
                    let s = (v ?? "").toString();
                    // Prevent CSV/Excel formula injection.
                    if (/^\s*[=+\-@]/.test(s)) s = "'" + s;
                    // RFC 4180-style escaping; we use ';' as delimiter for better Excel compatibility in ES locales.
                    if (/[\";\r\n]/.test(s)) return `"${s.replace(/\"/g, '""')}"`;
                    return s;
                };

                const safeName = (name) =>
                    (name || "classe")
                        .toString()
                        .trim()
                        .replace(/[^\w\d]+/g, "_")
                        .replace(/^_+|_+$/g, "")
                        .slice(0, 60) || "classe";

                const header = ["Classe", "ID", "Nom", "Punts", "Nivell", "Absent"];
                const rows = [header];
                const students = [...(currentClass.students || [])].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
                students.forEach(s => {
                    const level = this.getCompetencyLevel(s.score || 0).full;
                    rows.push([currentClass.name, s.id, s.name, s.score ?? 0, level, s.isAbsent ? "SI" : "NO"]);
                });

                const csv = rows.map(r => r.map(esc).join(";")).join("\r\n");
                const date = new Date().toISOString().split("T")[0];
                const filename = `puntuacions_${safeName(currentClass.name)}_${date}.csv`;

                try {
                    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }); // BOM helps Excel
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    setTimeout(() => URL.revokeObjectURL(url), 0);
                } catch (e) {
                    // Fallback (older browsers)
                    const uri = "data:text/csv;charset=utf-8," + encodeURIComponent("\ufeff" + csv);
                    const a = document.createElement("a");
                    a.href = uri;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                }

                this.showToast("CSV descarregat", "success");
            },

            // --- Target Score (NEW) ---
            updateTargetScorePrompt() {
                const add = prompt("Punts a afegir al màxim teòric:", "3");
                if(add && !isNaN(add)) {
                    this.currentTarget += parseInt(add);
                    this.saveData();
                    this.render();
                    this.showToast(`Afegits ${add} punts a l'objectiu`, 'success');
                }
            },
            resetTargetScore() {
                if(confirm("Vols reiniciar el màxim teòric a 0?")) {
                    this.currentTarget = 0;
                    this.saveData();
                    this.render();
                    this.showToast("Objectiu reiniciat", 'info');
                }
            },

            // --- Students ---
            addStudent(e) { e.preventDefault(); const name = document.getElementById('newStudentName').value.trim(); if(name) { this.addSingleStudent(name); document.getElementById('newStudentName').value = ''; this.showToast("Afegit", "success"); } },
            addSingleStudent(name) { const s = this.data; s.push({ id: this.generateShortId(), name, score: 0, isAbsent: false, history: [], actions: [] }); this.data = s; this.saveData(); this.render(); },
            processBulkImport() {
                const txt = document.getElementById('importTextarea').value;
                if (!txt.trim()) return this.closeImportModal();

                const normalize = (s) => s.trim().replace(/\s+/g, ' ');
                const normKey = (s) => normalize(s).toLocaleLowerCase('ca-ES');

                const rawNames = txt
                    .split('\n')
                    .map(n => normalize(n))
                    .filter(Boolean);

                if (!rawNames.length) return this.closeImportModal();

                const existing = new Set(this.data.map(s => normKey(s.name || '')));
                const seenInImport = new Set();

                const uniques = [];
                let dupExisting = 0;
                let dupImport = 0;

                for (const name of rawNames) {
                    const k = normKey(name);
                    if (existing.has(k)) { dupExisting++; continue; }
                    if (seenInImport.has(k)) { dupImport++; continue; }
                    seenInImport.add(k);
                    uniques.push(name);
                }

                let finalList = rawNames;
                const totalDups = dupExisting + dupImport;
                if (totalDups > 0) {
                    const msg =
                        `S'han detectat duplicats en la importació.\n\n` +
                        `- Ja existien a la classe: ${dupExisting}\n` +
                        `- Repetits dins del llistat: ${dupImport}\n\n` +
                        `Vols OMETRE els duplicats i importar només els nous?`;
                    const omit = confirm(msg);
                    finalList = omit ? uniques : rawNames;
                }

                finalList.forEach(n => this.addSingleStudent(n));
                this.closeImportModal();
            },
            deleteStudent(id) { if(confirm("Eliminar alumne?")) { this.data = this.data.filter(s => s.id !== id); this.saveData(); this.render(); this.showToast("Eliminat", "info"); } },
            toggleAttendance(id) { const s = this.data.find(x => x.id === id); if(s) { s.isAbsent = !s.isAbsent; this.saveData(); this.render(); } },
            updateScore(id, idx) {
                const s = this.data.find(x => x.id === id);
                if (s && !s.isAbsent) {
                    const cat = this.categories[idx];
                    const pts = cat.points;
                    s.score += pts;
                    s.history.unshift({ cat: cat.label, pts: pts, date: new Date().toLocaleDateString() });
                    if (s.history.length > 5) s.history.pop();

                    if (!Array.isArray(s.actions)) s.actions = [];
                    s.actions.push({ t: 'score', pts: pts, cat: cat.label, at: Date.now() });
                    if (s.actions.length > 50) s.actions = s.actions.slice(-50);

                    this.saveData();
                    this.render();
                    this.showToast(`${pts > 0 ? '+' : ''}${pts} pts`, pts > 0 ? 'success' : 'warning');
                }
            },
            undoLastAction(id) {
                const s = this.data.find(x => x.id === id);
                if (!s) return;
                if (!Array.isArray(s.actions) || s.actions.length === 0) return this.showToast("Res a desfer", "info");

                const a = s.actions.pop();
                if (!a || a.t !== 'score' || typeof a.pts !== 'number') {
                    this.saveData();
                    this.render();
                    return this.showToast("Res a desfer", "info");
                }

                s.score -= a.pts;
                // Remove the most recent matching history entry if present.
                if (Array.isArray(s.history) && s.history.length) {
                    const idx = s.history.findIndex(h => h && h.cat === a.cat && h.pts === a.pts);
                    if (idx !== -1) s.history.splice(idx, 1);
                }

                this.saveData();
                this.render();
                this.showToast(`Desfet ${a.pts > 0 ? '+' : ''}${a.pts} pts`, "info");
            },
            getCompetencyLevel(s) { const t = this.settings.thresholds; if(s >= t.ae) return { label: 'AE', rank: 'Mestre', full: 'Excel·lent', color: 'bg-green-500', text: 'text-green-600', border: 'border-green-200', bg: 'bg-green-50' }; if(s >= t.an) return { label: 'AN', rank: 'Expert', full: 'Notable', color: 'bg-blue-500', text: 'text-blue-600', border: 'border-blue-200', bg: 'bg-blue-50' }; if(s >= t.as) return { label: 'AS', rank: 'Aprenent', full: 'Satisfactori', color: 'bg-orange-500', text: 'text-orange-600', border: 'border-orange-200', bg: 'bg-orange-50' }; return { label: 'NA', rank: 'Novell', full: 'No Assolit', color: 'bg-red-500', text: 'text-red-600', border: 'border-red-200', bg: 'bg-red-50' }; },
            filterStudents() { const q = (document.getElementById('searchInput')?.value || '').toLowerCase(); this.render(q); },

            // --- Render ---
            render(filter = '') {
                if (this.mode === 'projection') return;
                const grid = document.getElementById('students-grid');
                grid.innerHTML = '';
                const filtered = this.data.filter(s => s.name.toLowerCase().includes(filter)).sort((a, b) => a.name.localeCompare(b.name));
                document.getElementById('student-count').innerText = filtered.length;
                
                // Update Target Score Display
                document.getElementById('target-score-display').innerText = this.currentTarget;

                if(!filtered.length) { document.getElementById('empty-state').classList.remove('hidden'); return; }
                document.getElementById('empty-state').classList.add('hidden');
                
                const maxThres = this.settings.thresholds.ae + 20;
                const currentTarget = this.currentTarget;

                filtered.forEach(s => {
                    const l = this.getCompetencyLevel(s.score);
                    const safeStudentName = this._escapeHtml(s.name);
                    const attendanceTitle = this._escapeAttr(s.isAbsent ? 'Marcar com present (activa els botons de punts)' : 'Marcar com absent (desactiva els botons de punts)');
                    const canUndo = Array.isArray(s.actions) && s.actions.length > 0;
                    const recent = (Array.isArray(s.history) ? s.history : []).slice(0, 3).map(h => {
                        const cat = this._escapeHtml(h?.cat ?? '');
                        const pts = typeof h?.pts === 'number' ? h.pts : (parseInt(h?.pts || 0, 10) || 0);
                        const ptsStr = `${pts > 0 ? '+' : ''}${pts}`;
                        return `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-gray-200 bg-white text-[10px] text-gray-600" title="Última activitat">${cat}<span class="font-mono font-bold text-gray-500">${this._escapeHtml(ptsStr)}</span></span>`;
                    }).join('');
                    const btns = this.categories.map((c, i) => `<button onclick="app.updateScore(${s.id}, ${i})" class="flex flex-col items-center justify-center p-1 sm:p-1.5 rounded-lg transition active:scale-95 ${c.color} border border-transparent hover:shadow-sm ${s.isAbsent ? 'opacity-50 cursor-not-allowed' : ''}" ${s.isAbsent ? 'disabled' : ''}><i class="fa-solid ${c.icon} text-sm mb-0.5"></i><span class="text-[9px] leading-none text-center">${this._escapeHtml(c.label)}</span><span class="text-[10px] font-bold mt-0.5">${c.points>0?'+':''}${c.points}</span></button>`).join('');
                    const card = document.createElement('div');
                    card.className = `bg-white rounded-xl shadow-sm border border-gray-100 p-3 md:p-4 card-enter flex flex-col md:flex-row gap-2 md:gap-4 items-center md:items-stretch relative overflow-hidden group ${s.isAbsent ? 'bg-gray-50 opacity-80' : ''}`;
                    
                    // Score display logic
                    let scoreDisplay = `<span class="block text-2xl font-black ${l.text} score-change ${s.isAbsent?'opacity-50':''}">${s.score}</span>`;
                    if (currentTarget > 0) {
                        scoreDisplay = `
                            <div class="flex items-baseline justify-end gap-1">
                                <span class="block text-2xl font-black ${l.text} score-change ${s.isAbsent?'opacity-50':''}">${s.score}</span>
                                <span class="text-sm text-gray-400 font-medium">/ ${currentTarget}</span>
                            </div>
                        `;
                    }

                    card.innerHTML = `
                        <div class="flex-1 w-full md:w-auto flex flex-col justify-between z-10">
                            <div class="flex justify-between items-start">
                                <div>
                                    <div class="flex items-center gap-2"><h3 class="text-base font-bold text-gray-800 ${s.isAbsent?'text-gray-500':''}">${safeStudentName}</h3>
                                    <label class="inline-flex items-center cursor-pointer ml-1 relative" title="${attendanceTitle}"><input type="checkbox" class="sr-only toggle-checkbox" onchange="app.toggleAttendance(${s.id})" ${s.isAbsent?'checked':''}><div class="w-6 h-3 bg-gray-200 rounded-full toggle-label transition-colors ${s.isAbsent?'bg-red-200':'bg-green-200'}"></div><div class="dot absolute w-1.5 h-1.5 bg-white rounded-full shadow left-0.5 top-0.5 transition-transform ${s.isAbsent?'translate-x-3 bg-red-500':'bg-green-500'}"></div></label></div>
                                    <div class="text-[10px] text-gray-400 font-mono mt-0.5">ID: ${this._escapeHtml(s.id)}</div>
                                </div>
                                <div class="text-right">
                                    <div class="flex items-start justify-end gap-1">
                                        <div>${scoreDisplay}</div>
                                        <button onclick="app.undoLastAction(${s.id})" class="mt-1 text-gray-300 hover:text-indigo-600 transition p-1 ${canUndo ? '' : 'opacity-30 cursor-not-allowed'}" ${canUndo ? '' : 'disabled'} title="Desfer l'últim canvi de punts">
                                            <i class="fa-solid fa-rotate-left text-[10px]"></i>
                                        </button>
                                    </div>
                                    <span class="text-[9px] text-gray-400 uppercase tracking-wider">Punts</span>
                                </div>
                            </div>
                            <div class="mt-2">
                                <div class="flex justify-between items-end mb-1">
                                    <div class="flex gap-1">
                                        <span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${l.bg} ${l.text} border ${l.border}">${l.full}</span>
                                        <span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-800 text-white border border-gray-600 flex items-center gap-1"><i class="fa-solid fa-trophy text-yellow-400 text-[9px]"></i> ${l.rank}</span>
                                    </div>
                                </div>
                                <div class="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                    <div class="${l.color} h-1.5 rounded-full transition-all duration-500" style="width: ${Math.min(100, Math.max(0, (s.score/maxThres)*100))}%"></div>
                                </div>
                                ${recent ? `<div class="mt-2 flex flex-wrap gap-1">${recent}</div>` : ''}
                            </div>
                        </div>
                        <div class="w-full h-px bg-gray-100 md:hidden z-10 my-1"></div><div class="hidden md:block w-px bg-gray-100 mx-1 z-10"></div>
                        <div class="w-full md:w-auto compact-btn-grid gap-1 md:gap-2 z-10">${btns}</div>
                        <div class="hidden md:flex flex-col justify-center pl-1 border-l border-gray-100 z-10"><button onclick="app.deleteStudent(${s.id})" class="text-gray-300 hover:text-red-500 transition p-1" title="Eliminar alumne"><i class="fa-solid fa-trash-alt text-xs"></i></button></div>
                        <button onclick="app.deleteStudent(${s.id})" class="md:hidden w-full text-center text-red-400 text-[10px] mt-1 z-10" title="Eliminar alumne">Eliminar alumne</button>
                    `;
                    grid.appendChild(card);
                });
            },
            
            toggleProjectionMode() {
                this.mode = this.mode === 'teacher' ? 'projection' : 'teacher';
                if(this.mode === 'projection') { document.getElementById('teacher-header').classList.add('hidden'); document.getElementById('teacher-view').classList.add('hidden'); document.getElementById('teacher-footer').classList.add('hidden'); document.getElementById('projection-header').classList.remove('hidden'); document.getElementById('projection-view').classList.remove('hidden'); this.renderProjection(); }
                else { document.getElementById('teacher-header').classList.remove('hidden'); document.getElementById('teacher-view').classList.remove('hidden'); document.getElementById('teacher-footer').classList.remove('hidden'); document.getElementById('projection-header').classList.add('hidden'); document.getElementById('projection-view').classList.add('hidden'); }
            },
            renderProjection() {
                const grid = document.getElementById('projection-grid'); grid.innerHTML = '';
                const sorted = [...this.data].sort((a, b) => a.id - b.id);
                if(!sorted.length) return grid.innerHTML = '<p class="text-gray-500 text-center col-span-full">Sense dades.</p>';
                sorted.forEach(s => {
                    const l = this.getCompetencyLevel(s.score);
                    const card = document.createElement('div');
                    card.className = `projection-card bg-gray-800 rounded-xl p-4 text-center border-2 ${l.border.replace('border-', 'border-opacity-50 border-')} shadow-lg relative overflow-hidden`;
                    card.innerHTML = `<div class="absolute top-0 left-0 w-full h-1 ${l.color}"></div><h3 class="text-2xl font-mono font-bold text-white mb-2 tracking-wider">${s.id}</h3><div class="my-2"><span class="text-4xl font-black text-white">${s.score}</span></div><div class="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${l.bg} ${l.text}">${l.full}</div>`;
                    grid.appendChild(card);
                });
            },

            showToast(m, t) { const el = document.getElementById('toast'); document.getElementById('toast-message').innerText=m; document.getElementById('toast-icon').className = t==='success'?'fa-solid fa-check-circle text-green-400':(t==='error'?'fa-solid fa-exclamation-circle text-red-400':'fa-solid fa-info-circle text-blue-400'); el.classList.remove('translate-y-20', 'opacity-0'); setTimeout(()=>el.classList.add('translate-y-20', 'opacity-0'), 3000); }
        };

        document.addEventListener('DOMContentLoaded', () => { window.app.init(); });
