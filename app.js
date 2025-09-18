document.addEventListener('DOMContentLoaded', () => {
    // A crucial check to ensure core libraries are loaded before starting the app.
    if (typeof moment === 'undefined' || typeof XLSX === 'undefined') {
        console.error('Core libraries (moment.js or xlsx.js) failed to load.');
        document.body.innerHTML = `<div class="text-center p-8 text-red-600 bg-white rounded-lg shadow-md max-w-md mx-auto mt-10"><strong>خطای بارگذاری</strong><p class="mt-2">کتابخانه‌های اصلی برنامه بارگذاری نشدند. لطفاً از اتصال به اینترنت اطمینان حاصل کرده و صفحه را دوباره بارگیری کنید.</p></div>`;
        return; // Stop execution immediately.
    }

    try {
        const config = {
            storageKeys: {
                data: 'overtime_app_data',
                settings: 'overtime_app_settings'
            },
            shiftPatterns: {
                'day_worker': { name: 'روزکار (شنبه تا چهارشنبه)', getShift: (dayIndex, dayOfWeek) => (dayOfWeek === 4 || dayOfWeek === 5) ? { key: 'rest', name: 'روز استراحت (آخر هفته)' } : { key: 'morning', name: 'روز کاری' }},
                'two_shift': { name: 'دو شیفت (هفته‌ای صبح/عصر)', getShift: (dayIndex, dayOfWeek) => { const week = Math.floor(dayIndex / 7) % 2; const isWeekend = (dayOfWeek === 4 || dayOfWeek === 5); if (week === 0) return isWeekend ? { key: 'rest', name: 'استراحت (هفته صبح)' } : { key: 'morning', name: 'شیفت صبح' }; return isWeekend ? { key: 'morning', name: 'شیفت صبح (روز تعطیل)'} : { key: 'evening', name: 'شیفت عصر' }; }},
                '3_3_3_3': { name: '۳ عصر، ۳ صبح، ۳ شب، ۳ استراحت', getShift: (dayIndex) => { const cyclePos = dayIndex % 12; if (cyclePos < 3) return { key: 'evening', name: `روز ${cyclePos + 1} عصر` }; if (cyclePos < 6) return { key: 'morning', name: `روز ${cyclePos - 2} صبح` }; if (cyclePos < 9) return { key: 'night', name: `روز ${cyclePos - 5} شب` }; return { key: 'rest', name: `روز ${cyclePos - 8} استراحت` }; }},
                '2_2_2_4': { name: '۲ عصر، ۲ صبح، ۲ شب، ۴ استراحت', getShift: (dayIndex) => { const cyclePos = dayIndex % 10; if (cyclePos < 2) return { key: 'evening', name: `روز ${cyclePos + 1} عصر` }; if (cyclePos < 4) return { key: 'morning', name: `روز ${cyclePos - 1} صبح` }; if (cyclePos < 6) return { key: 'night', name: `روز ${cyclePos - 3} شب` }; return { key: 'rest', name: `روز ${cyclePos - 5} استراحت` }; }},
            },
            shiftTypes: { 'morning': 'شیفت صبح', 'evening': 'شیفت عصر', 'night': 'شیفت شب', 'rest': 'استراحت', 'holiday': 'روز تعطیل', 'change_shift': 'چنج شیفت' },
        };
        const shiftTypeMapReverse = Object.fromEntries(Object.entries(config.shiftTypes).map(([k, v]) => [v, k]));

        const elements = Object.fromEntries(Array.from(document.querySelectorAll('[id]')).map(el => [el.id.replace(/-(\w)/g, (_, letter) => letter.toUpperCase()), el]));
        
        let state = {
            overtimeData: JSON.parse(localStorage.getItem(config.storageKeys.data)) || [],
            userSettings: JSON.parse(localStorage.getItem(config.storageKeys.settings)) || null,
            confirmCallback: null,
            autoCalculatedShift: null,
        };

        const gregorianToJalali = g => g ? moment(g, 'YYYY-MM-DD').locale('fa').format('jYYYY/jMM/jDD') : '';
        const jalaliToGregorian = j => j ? moment(j, 'jYYYY/jMM/jDD').locale('en').format('YYYY-MM-DD') : '';

        const saveData = () => localStorage.setItem(config.storageKeys.data, JSON.stringify(state.overtimeData));
        const saveSettings = () => localStorage.setItem(config.storageKeys.settings, JSON.stringify(state.userSettings));
        const calculateDuration = (start, end) => (parseInt(end) > parseInt(start)) ? (end - start) : (24 - start + parseInt(end));

        const showModal = (modal) => { modal.classList.remove('hidden'); setTimeout(() => modal.classList.remove('opacity-0'), 10); };
        const hideModal = (modal) => { modal.classList.add('opacity-0'); setTimeout(() => { modal.classList.add('hidden'); if (modal === elements.confirmModal) state.confirmCallback = null; }, 300); };
        const showError = (message, el = elements.errorMessage) => { el.textContent = message; el.classList.remove('hidden'); setTimeout(() => el.classList.add('hidden'), 5000); };

        const calculateShiftForDate = (jalaliDateStr) => {
            if (!state.userSettings?.pattern || !state.userSettings?.startDate) return null;
            const pattern = config.shiftPatterns[state.userSettings.pattern];
            if (!pattern) return null;
            const targetDate = moment(jalaliDateStr, 'jYYYY/jMM/jDD');
            const startDate = moment(state.userSettings.startDate, 'jYYYY/jMM/jDD');
            if (!targetDate.isValid() || !startDate.isValid()) return null;
            const dayDifference = targetDate.diff(startDate, 'days');
            const persianDayOfWeek = (targetDate.day() + 1) % 7;
            return pattern.getShift(dayDifference, persianDayOfWeek);
        };

        const updateAutoShiftDisplay = (jalaliDate) => {
            const calculatedShift = calculateShiftForDate(jalaliDate);
            state.autoCalculatedShift = calculatedShift;
            if (calculatedShift) {
                elements.autoShiftDisplay.textContent = `تشخیص خودکار: ${calculatedShift.name}`;
                if (elements.shiftTypeSelect.querySelector(`option[value="${calculatedShift.key}"]`)) {
                    elements.shiftTypeSelect.value = calculatedShift.key;
                }
            } else {
                elements.autoShiftDisplay.textContent = '';
            }
        };

        const renderRecords = () => {
            elements.overtimeRecords.innerHTML = '';
            elements.noRecords.style.display = state.overtimeData.length === 0 ? 'block' : 'none';
            const sortedData = [...state.overtimeData].sort((a, b) => moment(b.date, 'jYYYY/jMM/jDD').diff(moment(a.date, 'jYYYY/jMM/jDD')));
            sortedData.forEach(record => {
                const tr = document.createElement('tr');
                tr.className = 'bg-white hover:bg-gray-50 transition' + (record.isNonRoutine ? ' non-routine-record' : '');
                tr.innerHTML = `
                    <td class="p-4 text-sm">${record.date}</td><td class="p-4 text-sm">${config.shiftTypes[record.shiftType] || ''}</td>
                    <td class="p-4 text-sm">${record.successor || '-'}</td><td class="p-4 text-sm">${record.startTime}:00</td>
                    <td class="p-4 text-sm">${record.endTime}:00</td><td class="p-4 text-sm font-medium">${calculateDuration(record.startTime, record.endTime)} ساعت</td>
                    <td class="p-4 text-sm hidden md:table-cell">${record.description || '-'}</td>
                    <td class="p-4 text-sm"><button data-date="${record.date}" class="delete-btn text-red-500 hover:text-red-700 font-semibold">حذف</button></td>
                `;
                elements.overtimeRecords.appendChild(tr);
            });
            updateTotalHours();
        };

        const updateTotalHours = () => {
            const totalHours = state.overtimeData.reduce((total, record) => total + calculateDuration(record.startTime, record.endTime), 0);
            elements.totalHoursDisplay.textContent = `مجموع اضافه کاری: ${totalHours} ساعت`;
            elements.alertMessage.classList.toggle('hidden', totalHours <= 120);
            if (totalHours > 120) elements.alertMessage.innerHTML = `<span class="font-medium">توجه!</span> مجموع ساعات شما از ۱۲۰ ساعت عبور کرده.`;
        };

        const populateDropdowns = () => {
            ['shiftTypeSelect', 'shiftPatternSelect'].forEach(key => {
                const select = elements[key]; const source = key === 'shiftTypeSelect' ? config.shiftTypes : config.shiftPatterns;
                select.innerHTML = '';
                for (const [k, v] of Object.entries(source)) select.add(new Option(v.name || v, k));
            });
            ['startTimeSelect', 'endTimeSelect'].forEach(key => {
                const select = elements[key]; select.innerHTML = '';
                for (let i = 1; i <= 24; i++) select.add(new Option(`${i}:00`, i));
            });
        };

        const setDateAndDisplay = (input, display, gregorianDate) => {
            input.value = gregorianDate; const jalaliDate = gregorianToJalali(gregorianDate);
            display.textContent = jalaliDate; return jalaliDate;
        };

        const handleSaveSettings = () => {
            const gregorianStartDate = elements.cycleStartDateInput.value;
            if (!gregorianStartDate) return showError('لطفاً تاریخ شروع را انتخاب کنید.', elements.settingsError);
            state.userSettings = { pattern: elements.shiftPatternSelect.value, startDate: gregorianToJalali(gregorianStartDate) };
            saveSettings(); hideModal(elements.settingsModal); initializeMainApp();
        };

        const initializeMainApp = () => {
            elements.mainContent.classList.remove('hidden');
            const todayGregorian = moment().locale('en').format('YYYY-MM-DD');
            const jalaliDate = setDateAndDisplay(elements.dateInput, elements.jalaliDateDisplay, todayGregorian);
            updateAutoShiftDisplay(jalaliDate);
        };
        
        const openSettingsModal = () => {
            const gregorianDate = state.userSettings ? jalaliToGregorian(state.userSettings.startDate) : moment().locale('en').format('YYYY-MM-DD');
            if(state.userSettings) elements.shiftPatternSelect.value = state.userSettings.pattern;
            setDateAndDisplay(elements.cycleStartDateInput, elements.jalaliCycleDateDisplay, gregorianDate);
            showModal(elements.settingsModal);
        };

        const handleFormSubmit = (e) => {
            e.preventDefault();
            const jalaliDate = gregorianToJalali(elements.dateInput.value);
            if (!jalaliDate) return showError('لطفاً یک تاریخ انتخاب کنید.');
            const description = elements.descriptionInput.value.trim();
            const startTime = parseInt(elements.startTimeSelect.value);
            const isNonRoutine = state.autoCalculatedShift?.key === 'night' && startTime < 12;
            const finalDescription = isNonRoutine && !description.includes('غیر روتین') ? `غیر روتین - ${description}`.trim() : description;
            const record = { date: jalaliDate, startTime: elements.startTimeSelect.value, endTime: elements.endTimeSelect.value, description: finalDescription, shiftType: elements.shiftTypeSelect.value, successor: elements.successorInput.value.trim(), isNonRoutine };
            const existingIndex = state.overtimeData.findIndex(r => r.date === jalaliDate);
            if (existingIndex > -1) state.overtimeData[existingIndex] = record;
            else state.overtimeData.push(record);
            saveData(); renderRecords(); elements.overtimeForm.reset();
            const todayGregorian = moment().locale('en').format('YYYY-MM-DD');
            const todayJalali = setDateAndDisplay(elements.dateInput, elements.jalaliDateDisplay, todayGregorian);
            updateAutoShiftDisplay(todayJalali);
        };
        
        const handleDeleteAll = () => {
            if (state.overtimeData.length === 0) return showError("هیچ سابقه‌ای برای حذف نیست.");
            showModal(elements.confirmModal);
            elements.modalBody.textContent = "آیا از حذف تمام سوابق مطمئن هستید؟ این عمل غیرقابل بازگشت است.";
            elements.modalConfirmBtn.textContent = 'بله، همه را حذف کن';
            state.confirmCallback = () => { state.overtimeData = []; saveData(); renderRecords(); hideModal(elements.confirmModal); };
        };
        
        const handleDeleteSingle = (e) => {
             if (e.target.classList.contains('delete-btn')) {
                const dateToDelete = e.target.dataset.date;
                showModal(elements.confirmModal);
                elements.modalBody.textContent = `آیا از حذف اضافه کاری تاریخ ${dateToDelete} مطمئن هستید؟`;
                elements.modalConfirmBtn.textContent = 'تایید و حذف';
                state.confirmCallback = () => { state.overtimeData = state.overtimeData.filter(r => r.date !== dateToDelete); saveData(); renderRecords(); hideModal(elements.confirmModal); };
            }
        };

        const exportToExcel = () => {
            if(state.overtimeData.length === 0) return showError("داده ای برای خروجی نیست");
            const data = state.overtimeData.map(r => ({ 'تاریخ': r.date, 'نوع شیفت': config.shiftTypes[r.shiftType] || '', 'جانشین': r.successor || '', 'ساعت شروع': r.startTime, 'ساعت پایان': r.endTime, 'توضیحات': r.description || '', 'غیر روتین': r.isNonRoutine ? 'بله' : 'خیر' }));
            const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Overtime"); XLSX.writeFile(wb, "OvertimeRecords.xlsx");
        };

        const importFromExcel = (event) => {
            const file = event.target.files[0]; if(!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, {type: 'array'});
                    const ws = workbook.Sheets[workbook.SheetNames[0]];
                    const jsonData = XLSX.utils.sheet_to_json(ws);
                    if (jsonData.length === 0) return showError("فایل اکسل خالی یا نامعتبر است.");
                    const currentDataMap = state.overtimeData.reduce((map, item) => ({...map, [item.date]: item}), {});
                    let importedCount = 0;
                    jsonData.forEach(row => {
                        const date = String(row['تاریخ'] || '').trim();
                        if(moment(date, 'jYYYY/jMM/jDD', true).isValid()) {
                            currentDataMap[date] = { date, shiftType: shiftTypeMapReverse[row['نوع شیفت']] || 'change_shift', successor: String(row['جانشین'] || ''), startTime: String(row['ساعت شروع'] || '1'), endTime: String(row['ساعت پایان'] || '1'), description: String(row['توضیحات'] || ''), isNonRoutine: String(row['غیر روتین']).toLowerCase() === 'بله' };
                            importedCount++;
                        }
                    });
                    if (importedCount > 0) { state.overtimeData = Object.values(currentDataMap); saveData(); renderRecords(); } 
                    else { showError("هیچ رکورد معتبری در فایل اکسل یافت نشد."); }
                } catch (err) { showError("خطا در پردازش فایل اکسل."); } 
                finally { elements.importFile.value = ''; }
            };
            reader.readAsArrayBuffer(file);
        };

        // --- INITIALIZATION ---
        populateDropdowns();
        renderRecords();
        elements.settingsBtn.addEventListener('click', openSettingsModal);
        elements.settingsSaveBtn.addEventListener('click', handleSaveSettings);
        elements.dateInput.addEventListener('change', e => updateAutoShiftDisplay(setDateAndDisplay(elements.dateInput, elements.jalaliDateDisplay, e.target.value)));
        elements.cycleStartDateInput.addEventListener('change', e => setDateAndDisplay(elements.cycleStartDateInput, elements.jalaliCycleDateDisplay, e.target.value));
        elements.overtimeForm.addEventListener('submit', handleFormSubmit);
        elements.deleteAllBtn.addEventListener('click', handleDeleteAll);
        elements.overtimeRecords.addEventListener('click', handleDeleteSingle);
        elements.modalConfirmBtn.addEventListener('click', () => { if (state.confirmCallback) state.confirmCallback(); });
        elements.modalCancelBtn.addEventListener('click', () => hideModal(elements.confirmModal));
        elements.importBtn.addEventListener('click', () => elements.importFile.click());
        elements.importFile.addEventListener('change', importFromExcel);
        elements.exportBtn.addEventListener('click', exportToExcel);

        if (!state.userSettings) { openSettingsModal(); } 
        else { initializeMainApp(); }

    } catch(e) {
        console.error("Critical Initialization Error:", e);
        document.body.innerHTML = `<div class="text-center p-8 text-red-600 bg-white rounded-lg shadow-md max-w-md mx-auto mt-10"><strong>یک خطای غیرمنتظره و جدی رخ داد.</strong><p class="mt-2"> لطفاً حافظه کش مرورگر را پاک کرده و دوباره امتحان کنید. اگر مشکل ادامه داشت، با توسعه‌دهنده تماس بگیرید.</p></div>`;
    }
});
