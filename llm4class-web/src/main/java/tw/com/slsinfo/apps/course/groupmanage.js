(function () {
    'use strict';

    // 純前端暫存資料結構
    var tempGroupAssignments = new Map(); // studentId -> groupId (null表示未分配)
    var originalAssignments = new Map();  // 記錄原始分配狀態
    var hasUnsavedChanges = false;
    var saveCallbackUrl = '';

    // 初始化時記錄原始狀態
    function recordOriginalAssignments() {
        tempGroupAssignments.clear();
        originalAssignments.clear();

        // 記錄所有學生的原始組別分配
        $('.student-item[data-student-id]').each(function () {
            var studentId = $(this).attr('data-student-id');
            var groupContainer = $(this).closest('.group-container[data-group-id]');
            var groupId = groupContainer.length > 0 ? groupContainer.attr('data-group-id') : null;

            if (studentId) {
                originalAssignments.set(studentId, groupId);
                tempGroupAssignments.set(studentId, groupId);
                console.log('記錄原始分配 - 學生:', studentId, '組別:', groupId);
            }
        });

        // 記錄未分配區域的學生
        $('.unassigned-area .student-item[data-student-id]').each(function () {
            var studentId = $(this).attr('data-student-id');
            if (studentId) {
                originalAssignments.set(studentId, null);
                tempGroupAssignments.set(studentId, null);
                console.log('記錄未分配學生:', studentId);
            }
        });

        hasUnsavedChanges = false;
        updateSaveButtonState();
        console.log('原始分配狀態記錄完成，共', originalAssignments.size, '名學生');
    }

    function waitForJQueryUI(callback, maxAttempts) {
        maxAttempts = maxAttempts || 50;
        var attempts = 0;

        function checkJQueryUI() {
            attempts++;
            if (typeof $ !== 'undefined' && $.ui && $.ui.draggable && $.ui.droppable) {
                console.log('jQuery UI 已載入完成');
                callback();
            } else if (attempts < maxAttempts) {
                console.log('等待 jQuery UI 載入中... 第', attempts, '次嘗試');
                setTimeout(checkJQueryUI, 100);
            } else {
                console.error('jQuery UI 載入超時');
                showErrorToast('拖曳功能載入失敗，請重新整理頁面');
            }
        }

        checkJQueryUI();
    }

    function initDragAndDrop() {
        try {
            if (typeof $ === 'undefined' || !$.ui || !$.ui.draggable || !$.ui.droppable) {
                console.error('jQuery UI 未正確載入');
                return;
            }

            // 清除現有設定
            $('.student-item').each(function () {
                if ($(this).hasClass('ui-draggable')) {
                    try {
                        $(this).draggable('destroy');
                    } catch (e) {
                        // 忽略清除錯誤
                    }
                }
                $(this).removeClass('ui-draggable ui-draggable-handle dragging-original temp-assigned');
            });

            $('.group-container, .unassigned-area').each(function () {
                if ($(this).hasClass('ui-droppable')) {
                    try {
                        $(this).droppable('destroy');
                    } catch (e) {
                        // 忽略清除錯誤
                    }
                }
                $(this).removeClass('ui-droppable drop-target drop-success');
            });

            // 設定可拖曳元素
            $('.student-item[data-student-id]').draggable({
                revert: 'invalid',
                helper: 'clone',
                zIndex: 1000,
                opacity: 0.8,
                cursor: 'move',
                containment: 'document',
                start: function (event, ui) {
                    var studentId = $(this).attr('data-student-id');
                    var studentName = $(this).find('[wicket\\:id="studentName"], [wicket\\:id="memberName"]').text().trim();

                    console.log('開始拖曳 - ID:', studentId, 'Name:', studentName || '(未取得姓名)');

                    $(ui.helper).addClass('dragging-helper');
                    $(ui.helper).attr('data-student-id', studentId);
                    $(this).addClass('dragging-original');
                },
                stop: function (event, ui) {
                    $(this).removeClass('dragging-original');
                }
            });

            // 設定放置區域
            $('.group-container[data-group-id], .unassigned-area[data-group-id]').droppable({
                accept: '.student-item[data-student-id]',
                tolerance: 'pointer',
                over: function (event, ui) {
                    $(this).addClass('drop-target');
                },
                out: function (event, ui) {
                    $(this).removeClass('drop-target');
                },
                drop: function (event, ui) {
                    var $dropZone = $(this);
                    $dropZone.removeClass('drop-target').addClass('drop-success');

                    var studentId = ui.draggable.attr('data-student-id') || ui.helper.attr('data-student-id');
                    var groupId = $dropZone.attr('data-group-id') || null;

                    // 轉換空字符串為 null
                    if (groupId === '') groupId = null;

                    console.log('拖曳放下 - 學生ID:', studentId, '目標組別:', groupId);

                    if (studentId) {
                        // 純前端處理暫存分配
                        handleTempAssignment(studentId, groupId);

                        // 立即更新 UI 顯示
                        updateUIForAssignment(studentId, groupId, $dropZone);
                    }

                    // 移除成功提示樣式
                    setTimeout(function () {
                        $dropZone.removeClass('drop-success');
                    }, 800);
                }
            });

            var draggableCount = $('.student-item[data-student-id]').length;
            var droppableCount = $('.group-container[data-group-id], .unassigned-area[data-group-id]').length;
            console.log('拖曳功能初始化成功 - 可拖曳:', draggableCount, '放置區域:', droppableCount);

        } catch (e) {
            console.error('拖曳功能初始化失敗:', e);
            showErrorToast('拖曳功能初始化失敗');
        }
    }

    function handleTempAssignment(studentId, newGroupId) {
        try {
            var originalGroupId = originalAssignments.get(studentId);

            // 更新暫存分配
            tempGroupAssignments.set(studentId, newGroupId);

            // 檢查是否有變更
            var hasChanged = (originalGroupId !== newGroupId);
            hasUnsavedChanges = hasChanged || hasPendingChanges();

            console.log('暫存分配 - 學生:', studentId, '原始組別:', originalGroupId, '新組別:', newGroupId, '有變更:', hasChanged);

            // 更新UI狀態
            updateSaveButtonState();
            updateStudentVisualStatus(studentId, hasChanged);

            // 顯示暫存成功提示
            if (hasChanged) {
                showTempSuccessToast('學生已暫時分配，請記得儲存變更');
            }

        } catch (e) {
            console.error('處理暫存分配時發生錯誤:', e);
            showErrorToast('暫存分配失敗');
        }
    }

    function hasPendingChanges() {
        for (let [studentId, tempGroupId] of tempGroupAssignments) {
            if (originalAssignments.get(studentId) !== tempGroupId) {
                return true;
            }
        }
        return false;
    }

    function updateStudentVisualStatus(studentId, hasChanged) {
        $('.student-item[data-student-id="' + studentId + '"]').each(function () {
            if (hasChanged) {
                $(this).addClass('temp-changed');
            } else {
                $(this).removeClass('temp-changed');
            }
        });
    }

    function updateUIForAssignment(studentId, groupId, $dropZone) {
        // 暫時隱藏被拖曳的學生元素，避免重複顯示
        var $draggedStudent = $('.student-item[data-student-id="' + studentId + '"]').first();

        if ($draggedStudent.length > 0) {
            // 複製學生元素到目標位置
            var $newStudentElement = $draggedStudent.clone();
            $newStudentElement.removeClass('ui-draggable ui-draggable-handle dragging-original');

            // 找到目標容器
            var $targetContainer;
            if (groupId === null) {
                $targetContainer = $('.unassigned-area .students-container');
                if ($targetContainer.length === 0) {
                    $targetContainer = $('.unassigned-area');
                }
            } else {
                $targetContainer = $('.group-container[data-group-id="' + groupId + '"] .members-container');
                if ($targetContainer.length === 0) {
                    $targetContainer = $('.group-container[data-group-id="' + groupId + '"]').find('.members-container, .group-container').first();
                }
            }

            if ($targetContainer.length > 0) {
                // 移除原有位置的學生元素
                $('.student-item[data-student-id="' + studentId + '"]').not($newStudentElement).remove();

                // 添加到新位置
                $targetContainer.append($newStudentElement);

                console.log('UI更新完成 - 學生', studentId, '移動到', groupId ? ('組別' + groupId) : '未分配區域');

                // 重新初始化拖曳功能
                setTimeout(function () {
                    initDragAndDrop();
                }, 100);
            }
        }
    }

    // 對應替代後端方案的前端修改
    function batchSaveAssignments() {
        if (!hasUnsavedChanges || !saveCallbackUrl) {
            showInfoToast('沒有需要儲存的變更');
            return;
        }

        showLoadingIndicator('正在儲存分組變更...');

        // 準備批次資料 - 使用簡單的字符串格式
        var assignmentsArray = [];
        var changeCount = 0;

        for (let [studentId, tempGroupId] of tempGroupAssignments) {
            var originalGroupId = originalAssignments.get(studentId);
            if (originalGroupId !== tempGroupId) {
                // 格式：studentId:groupId
                var groupIdStr = tempGroupId === null ? 'null' : tempGroupId.toString();
                assignmentsArray.push(studentId + ':' + groupIdStr);
                changeCount++;
            }
        }

        if (changeCount === 0) {
            hideLoadingIndicator();
            showInfoToast('沒有需要儲存的變更');
            return;
        }

        // 合併為單一字符串：studentId1:groupId1,studentId2:groupId2,studentId3:null
        var assignmentsData = assignmentsArray.join(',');

        console.log('準備批次儲存', changeCount, '個變更:', assignmentsData);

        // 發送批次儲存請求
        $.ajax({
            url: saveCallbackUrl,
            type: 'POST',
            data: {
                assignmentsData: assignmentsData
            },
            timeout: 30000, // 30秒超時
            success: function (response) {
                console.log('批次儲存成功');
                hideLoadingIndicator();
                showSuccessToast('分組儲存成功！共處理 ' + changeCount + ' 個變更');

                // 更新原始分配狀態
                for (let [studentId, groupId] of tempGroupAssignments) {
                    originalAssignments.set(studentId, groupId);
                }

                hasUnsavedChanges = false;
                updateSaveButtonState();

                // 移除所有暫時變更樣式
                $('.student-item').removeClass('temp-changed');

                // 重新載入頁面以確保資料同步
                setTimeout(function () {
                    showSuccessToast('資料已儲存，正在重新整理頁面...');
                    setTimeout(function () {
                        window.location.reload();
                    }, 1500);
                }, 1000);
            },
            error: function (xhr, status, error) {
                console.error('批次儲存失敗:', status, error);
                hideLoadingIndicator();

                var errorMessage = '儲存失敗';
                if (xhr.responseText) {
                    try {
                        // 嘗試從回應中提取錯誤訊息
                        if (xhr.responseText.includes('showErrorToast')) {
                            errorMessage = '伺服器處理錯誤';
                        }
                    } catch (e) {
                        errorMessage = status === 'timeout' ? '請求超時，請重試' : '網路錯誤';
                    }
                }

                showErrorToast(errorMessage);
            }
        });
    }

    // Toast 和 UI 控制函數
    function initToastSystem() {
        var toastTypes = [
            {id: 'success-toast', class: 'success-toast', icon: '✓'},
            {id: 'error-toast', class: 'error-toast', icon: '✗'},
            {id: 'warning-toast', class: 'warning-toast', icon: '⚠'},
            {id: 'info-toast', class: 'info-toast', icon: 'ℹ'},
            {id: 'temp-success-toast', class: 'temp-success-toast', icon: '⏳'}
        ];

        toastTypes.forEach(function (toast) {
            if ($('#' + toast.id).length === 0) {
                $('body').append(
                    '<div id="' + toast.id + '" class="toast ' + toast.class + '">' +
                    '<div class="toast-content">' +
                    '<span class="toast-icon">' + toast.icon + '</span>' +
                    '<span class="toast-message"></span>' +
                    '</div>' +
                    '</div>'
                );
            }
        });
    }

    function showToast(toastId, message) {
        var $toast = $('#' + toastId);
        if ($toast.length === 0) {
            initToastSystem();
            $toast = $('#' + toastId);
        }

        $toast.find('.toast-message').text(message);
        $toast.addClass('show');

        setTimeout(function () {
            $toast.removeClass('show');
        }, 4000);
    }

    function showSuccessToast(message) {
        showToast('success-toast', message);
    }

    function showErrorToast(message) {
        showToast('error-toast', message);
    }

    function showWarningToast(message) {
        showToast('warning-toast', message);
    }

    function showInfoToast(message) {
        showToast('info-toast', message);
    }

    function showTempSuccessToast(message) {
        showToast('temp-success-toast', message);
    }

    function initLoadingIndicator() {
        if ($('#loading-indicator').length === 0) {
            $('body').append(
                '<div id="loading-indicator" class="loading-overlay">' +
                '<div class="loading-content">' +
                '<div class="spinner"></div>' +
                '<p>處理中...</p>' +
                '</div>' +
                '</div>'
            );
        }
    }

    function showLoadingIndicator(message) {
        var $indicator = $('#loading-indicator');
        if (message) {
            $indicator.find('p').text(message);
        }
        $indicator.css('display', 'flex');
    }

    function hideLoadingIndicator() {
        $('#loading-indicator').hide();
    }

    function initUnsavedChangesIndicator() {
        if ($('#unsaved-changes-indicator').length === 0) {
            $('body').append(
                '<div id="unsaved-changes-indicator" class="unsaved-changes-indicator">' +
                '⚠ 有未儲存的變更 (' + '<span class="change-count">0</span>' + ' 項)' +
                '</div>'
            );
        }
    }

    function updateSaveButtonState() {
        var $saveButton = $('[wicket\\:id="saveGroupsButton"]');
        var changeCount = 0;

        // 計算變更數量
        for (let [studentId, tempGroupId] of tempGroupAssignments) {
            if (originalAssignments.get(studentId) !== tempGroupId) {
                changeCount++;
            }
        }

        hasUnsavedChanges = changeCount > 0;

        if (hasUnsavedChanges) {
            $saveButton.addClass('has-changes');
            $saveButton.text('儲存分組 (' + changeCount + ' 項變更)');
            $('#unsaved-changes-indicator').show();
            $('#unsaved-changes-indicator .change-count').text(changeCount);
        } else {
            $saveButton.removeClass('has-changes');
            $saveButton.text('儲存分組');
            $('#unsaved-changes-indicator').hide();
        }
    }

    function resetToOriginalState() {
        if (confirm('確定要重設所有變更嗎？這將會清除所有未儲存的拖曳操作。')) {
            // 重置暫存資料
            tempGroupAssignments.clear();
            for (let [studentId, groupId] of originalAssignments) {
                tempGroupAssignments.set(studentId, groupId);
            }

            hasUnsavedChanges = false;
            updateSaveButtonState();

            // 移除所有暫時變更樣式
            $('.student-item').removeClass('temp-changed');

            showInfoToast('已重設至原始狀態');

            // 重新載入頁面以恢復原始UI
            setTimeout(function () {
                window.location.reload();
            }, 1000);
        }
    }

    function setSaveCallbackUrl(url) {
        saveCallbackUrl = url;
        console.log('設定批次儲存回調 URL:', url);
    }

    // 頁面卸載警告
    function initPageUnloadWarning() {
        $(window).on('beforeunload', function (e) {
            if (hasUnsavedChanges) {
                var message = '您有未儲存的分組變更，確定要離開嗎？';
                e.returnValue = message;
                return message;
            }
        });
    }

    // 模態框控制函數
    function showModal() {
        console.log('顯示模態框');
        var $modal = $('.custom-modal');
        if ($modal.length > 0) {
            $modal.addClass('show').show();
            // 聚焦到組別名稱輸入框
            setTimeout(function () {
                $modal.find('input[name="groupname"]').focus();
            }, 100);
        } else {
            console.error('找不到模態框元素');
        }
    }

    function hideModal() {
        console.log('隱藏模態框');
        var $modal = $('.custom-modal');
        $modal.removeClass('show').hide();

        // 清空表單
        $modal.find('input[name="groupname"]').val('');

        // 隱藏錯誤訊息
        $modal.find('.alert-danger').hide();
    }

// 點擊模態框背景時關閉
    $(document).on('click', '.custom-modal', function (e) {
        if (e.target === this) {
            hideModal();
        }
    });

// 按 ESC 鍵關閉模態框
    $(document).on('keydown', function (e) {
        if (e.keyCode === 27 && $('.custom-modal.show').length > 0) {
            hideModal();
        }
    });

// 暴露到全域範圍
    window.showModal = showModal;
    window.hideModal = hideModal;

    // DOM 載入完成後初始化
    $(document).ready(function () {
        console.log('純前端拖曳系統初始化開始');

        initToastSystem();
        initLoadingIndicator();
        initUnsavedChangesIndicator();
        initPageUnloadWarning();

        // 等待 jQuery UI 載入後初始化
        waitForJQueryUI(function () {
            console.log('開始記錄原始分配狀態');
            recordOriginalAssignments();
            initDragAndDrop();
            console.log('純前端拖曳系統初始化完成');
        });
    });

    function safeReinit() {
        try {
            console.log('安全重新初始化開始');

            console.log('純前端拖曳系統初始化開始');

            initToastSystem();
            initLoadingIndicator();
            initUnsavedChangesIndicator();
            initPageUnloadWarning();

            // 等待 jQuery UI 載入後初始化
            waitForJQueryUI(function () {
                console.log('開始記錄原始分配狀態');
                recordOriginalAssignments();
                initDragAndDrop();
                console.log('純前端拖曳系統初始化完成');
            });

        } catch (e) {
            console.error('重新初始化失敗:', e);
        }
    }

    // 暴露全域函數
    window.handleTempAssignment = handleTempAssignment;
    window.batchSaveAssignments = batchSaveAssignments;
    window.setSaveCallbackUrl = setSaveCallbackUrl;
    window.resetToOriginalState = resetToOriginalState;
    window.recordOriginalAssignments = recordOriginalAssignments;
    window.initDragAndDrop = initDragAndDrop;
    window.showSuccessToast = showSuccessToast;
    window.showErrorToast = showErrorToast;
    window.showWarningToast = showWarningToast;
    window.showInfoToast = showInfoToast;
    window.safeReinit = safeReinit;
    window.showTempSuccessToast = showTempSuccessToast;
    window.showLoadingIndicator = showLoadingIndicator;
    window.hideLoadingIndicator = hideLoadingIndicator;

    console.log('純前端拖曳模組載入完成');

})();