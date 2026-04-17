// groupmanage.js - 修復版本
(function() {
    'use strict';

    var dragDropCallbackUrl = '';

    function waitForJQueryUI(callback) {
        if (typeof $ !== 'undefined' && typeof $.ui !== 'undefined' && $.ui.draggable) {
            callback();
        } else {
            setTimeout(function() {
                waitForJQueryUI(callback);
            }, 50);
        }
    }

    $(document).ready(function() {
        console.log('DOM 已準備就緒');

        waitForJQueryUI(function() {
            console.log('jQuery UI 已載入，版本:', $.ui.version);
            initDragAndDrop();
            initModalControl();
            initToastSystem();
            initLoadingIndicator();
        });
    });

    function initDragAndDrop() {
        try {
            // 清除現有的拖拽設定
            $('.student-item').each(function() {
                if ($(this).hasClass('ui-draggable')) {
                    try {
                        $(this).draggable('destroy');
                    } catch (e) {
                        console.warn('清除拖拽設定時發生警告:', e.message);
                    }
                }
                $(this).removeClass('ui-draggable ui-draggable-handle dragging-original');
            });

            $('.group-container, .unassigned-area').each(function() {
                if ($(this).hasClass('ui-droppable')) {
                    try {
                        $(this).droppable('destroy');
                    } catch (e) {
                        console.warn('清除放置區域設定時發生警告:', e.message);
                    }
                }
                $(this).removeClass('ui-droppable drop-target drop-success');
            });

            // 檢查並記錄所有學生項目的屬性
            $('.student-item').each(function(index) {
                var $this = $(this);
                var studentId = $this.attr('data-student-id') || $this.data('student-id');
                var studentName = $this.find('[wicket\\:id="studentName"], [wicket\\:id="memberName"]').text();
                console.log('學生項目 ' + index + ' - ID: ' + studentId + ', Name: ' + studentName);

                if (!studentId) {
                    console.warn('學生項目缺少 data-student-id 屬性:', $this[0]);
                }
            });

            // 重新設定拖拽
            $('.student-item[data-student-id]').draggable({
                revert: 'invalid',
                helper: 'clone',
                zIndex: 1000,
                opacity: 0.8,
                cursor: 'move',
                containment: 'document',
                start: function(event, ui) {
                    $(ui.helper).addClass('dragging-helper');
                    $(this).addClass('dragging-original');

                    var $original = $(this);
                    var studentId = $original.attr('data-student-id') || $original.data('student-id');
                    var studentName = $original.find('[wicket\\:id="studentName"], [wicket\\:id="memberName"]').text();

                    console.log('開始拖拽學生 - ID:', studentId, 'Name:', studentName);
                    $(ui.helper).attr('data-student-id', studentId);
                },
                stop: function(event, ui) {
                    $(this).removeClass('dragging-original');
                    $(ui.helper).removeClass('dragging-helper');
                }
            });

            // 設定放置目標
            $('.group-container[data-group-id], .unassigned-area[data-group-id]').droppable({
                accept: '.student-item[data-student-id]',
                tolerance: 'pointer',
                over: function(event, ui) {
                    $(this).addClass('drop-target');
                    console.log('進入放置區域');
                },
                out: function(event, ui) {
                    $(this).removeClass('drop-target');
                },
                drop: function(event, ui) {
                    var $dropZone = $(this);
                    $dropZone.removeClass('drop-target');

                    var studentId = ui.draggable.attr('data-student-id') ||
                        ui.draggable.data('student-id') ||
                        ui.helper.attr('data-student-id') ||
                        ui.helper.data('student-id');

                    var groupId = $dropZone.attr('data-group-id') || $dropZone.data('group-id') || null;

                    console.log('拖拽放下詳細資訊:');
                    console.log('- 最終 studentId:', studentId);
                    console.log('- groupId:', groupId);

                    if (studentId && dragDropCallbackUrl) {
                        showLoadingIndicator('移動學生中...');
                        $dropZone.addClass('drop-success');

                        // 修復的 AJAX 請求 - 添加詳細的回應檢查
                        $.ajax({
                            url: dragDropCallbackUrl,
                            type: 'POST',
                            data: {
                                studentId: studentId,
                                groupId: groupId
                            },
                            success: function(response, textStatus, jqXHR) {
                                console.log('AJAX 請求成功完成');
                                console.log('- 狀態:', textStatus);
                                console.log('- 回應類型:', jqXHR.getResponseHeader('Content-Type'));
                                console.log('- 回應長度:', response.length);

                                // 檢查回應格式
                                if (response.indexOf('<?xml') === 0 || response.indexOf('<ajax-response') !== -1) {
                                    console.log('✓ 收到 Wicket AJAX 回應格式');
                                    console.log('學生分配成功');
                                    showSuccessToast('學生分配成功');

                                } else if (response.indexOf('<!DOCTYPE html>') === 0) {
                                    console.error('✗ 收到完整 HTML 頁面而非 AJAX 回應');
                                    console.log('回應開頭:', response.substring(0, 200));
                                    showErrorToast('伺服器回應格式錯誤，請重新整理頁面');

                                    // 建議重新整理頁面
                                    setTimeout(function() {
                                        if (confirm('偵測到頁面狀態不同步，是否要重新整理頁面？')) {
                                            window.location.reload();
                                        }
                                    }, 2000);
                                } else {
                                    console.log('收到其他格式回應');
                                    showSuccessToast('操作完成');
                                }

                                hideLoadingIndicator();

                                // 移除視覺回饋
                                setTimeout(function() {
                                    $dropZone.removeClass('drop-success');
                                }, 1000);

                                // DOM 更新檢查和重新初始化
                                setTimeout(function() {
                                    console.log('檢查 DOM 更新結果...');

                                    var studentElement = $('[data-student-id="' + studentId + '"]');
                                    if (studentElement.length > 0) {
                                        var currentContainer = studentElement.closest('.group-container, .unassigned-area');
                                        var currentGroupId = currentContainer.attr('data-group-id') || '';
                                        console.log('學生 ' + studentId + ' 現在在組別:', currentGroupId);

                                        if (currentGroupId == groupId) {
                                            console.log('✓ 學生已成功移動到目標組別');
                                        } else {
                                            console.log('✗ 學生尚未移動到目標組別');
                                        }
                                    }

                                    // 重新初始化拖拽功能
                                    if (typeof window.safeReinit === 'function') {
                                        window.safeReinit();
                                    }
                                }, 300);
                            },
                            error: function(xhr, status, error) {
                                console.error('AJAX 請求失敗:');
                                console.error('- 狀態:', status);
                                console.error('- 錯誤:', error);
                                console.error('- HTTP 狀態碼:', xhr.status);
                                console.error('- 回應文字:', xhr.responseText);

                                showErrorToast('網路請求失敗，請重試');
                                hideLoadingIndicator();

                                // 移除視覺回饋
                                setTimeout(function() {
                                    $dropZone.removeClass('drop-success');
                                }, 1000);
                            },
                            timeout: 10000 // 10秒超時
                        });

                    } else {
                        console.error('缺少必要參數:');
                        console.error('- studentId:', studentId);
                        console.error('- callbackUrl:', dragDropCallbackUrl);
                        showErrorToast('操作失敗：缺少必要參數');
                    }
                }
            });

            var draggableCount = $('.student-item[data-student-id]').length;
            var droppableCount = $('.group-container[data-group-id], .unassigned-area[data-group-id]').length;
            console.log('拖拽功能初始化成功 - 可拖拽元素:', draggableCount, '可放置區域:', droppableCount);

        } catch (e) {
            console.error('拖拽功能初始化失敗:', e);
            showErrorToast('拖拽功能初始化失敗');
        }
    }

    function initModalControl() {
        console.log('初始化模態框控制');

        $('.custom-modal').off('click.modal');
        $(document).off('keydown.modal');
        $('.close-btn, [data-action="cancel"]').off('click.modal');

        $('.custom-modal').on('click.modal', function(e) {
            if (e.target === this) {
                console.log('點擊背景關閉模態框');
                hideModal();
            }
        });

        $(document).on('keydown.modal', function(e) {
            if (e.keyCode === 27 && $('.custom-modal.show').length > 0) {
                console.log('ESC 鍵關閉模態框');
                hideModal();
            }
        });

        $(document).on('click.modal', '.close-btn, [data-action="cancel"], .modal-close-trigger', function(e) {
            e.preventDefault();
            console.log('點擊關閉/取消按鈕');
            hideModal();
        });

        $(document).on('click', '[data-dismiss="modal"]', function(e) {
            e.preventDefault();
            hideModal();
        });

        console.log('模態框控制初始化完成');
    }

    function showModal() {
        console.log('顯示模態框');
        var $modal = $('.custom-modal');

        if ($modal.length === 0) {
            console.error('找不到模態框元素');
            return;
        }

        $modal.addClass('show');
        $('body').addClass('modal-open');

        setTimeout(function() {
            $modal.find('input[type="text"]:visible').first().focus();
        }, 300);

        console.log('模態框已顯示');
    }

    function hideModal() {
        console.log('隱藏模態框');
        var $modal = $('.custom-modal');

        $modal.removeClass('show');
        $('body').removeClass('modal-open');

        var form = $modal.find('form')[0];
        if (form) {
            form.reset();
        }

        console.log('模態框已隱藏');
    }

    function initToastSystem() {
        if ($('#success-toast').length === 0) {
            $('body').append('<div id="success-toast" class="toast success-toast"><div class="toast-content"><span class="toast-icon">✓</span><span class="toast-message"></span></div></div>');
        }

        if ($('#error-toast').length === 0) {
            $('body').append('<div id="error-toast" class="toast error-toast"><div class="toast-content"><span class="toast-icon">✗</span><span class="toast-message"></span></div></div>');
        }
    }

    function showSuccessToast(message) {
        var $toast = $('#success-toast');
        $toast.find('.toast-message').text(message);
        $toast.addClass('show');

        setTimeout(function() {
            $toast.removeClass('show');
        }, 3000);
    }

    function showErrorToast(message) {
        var $toast = $('#error-toast');
        $toast.find('.toast-message').text(message);
        $toast.addClass('show');

        setTimeout(function() {
            $toast.removeClass('show');
        }, 3000);
    }

    function initLoadingIndicator() {
        if ($('#loading-indicator').length === 0) {
            $('body').append('<div id="loading-indicator" class="loading-overlay"><div class="loading-content"><div class="spinner"></div><p>處理中...</p></div></div>');
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

    function setDragDropCallbackUrl(url) {
        dragDropCallbackUrl = url;
        console.log('設定拖拽回調 URL:', url);

        if ($('.student-item').length > 0 && $('.student-item.ui-draggable').length === 0) {
            console.log('發現未初始化的拖拽元素，重新初始化');
            waitForJQueryUI(function() {
                initDragAndDrop();
            });
        }
    }

    function safeReinit() {
        try {
            console.log('安全重新初始化開始');

            // 等待 DOM 更新完成
            setTimeout(function() {
                waitForJQueryUI(function() {
                    console.log('重新初始化拖拽功能');

                    // 檢查是否有新的學生項目需要初始化
                    var uninitializedItems = $('.student-item:not(.ui-draggable)');
                    var uninitializedDropzones = $('.group-container:not(.ui-droppable), .unassigned-area:not(.ui-droppable)');

                    console.log('找到未初始化的可拖拽項目:', uninitializedItems.length);
                    console.log('找到未初始化的放置區域:', uninitializedDropzones.length);

                    // 完全重新初始化拖拽功能
                    initDragAndDrop();

                    // 重新設定回調 URL
                    if (dragDropCallbackUrl && typeof window.setDragDropCallbackUrl === 'function') {
                        window.setDragDropCallbackUrl(dragDropCallbackUrl);
                    }

                    console.log('安全重新初始化完成');
                });
            }, 150);

        } catch (e) {
            console.error('重新初始化失敗:', e);
        }
    }

    // 增強的 Wicket AJAX 事件監聽
    if (typeof Wicket !== 'undefined') {
        console.log('設定 Wicket AJAX 事件監聽器');

        Wicket.Event.subscribe('/ajax/call/complete', function() {
            console.log('Wicket AJAX 調用完成，準備重新初始化');
            safeReinit();
        });

        Wicket.Event.subscribe('/ajax/call/before', function() {
            console.log('Wicket AJAX 調用開始');
        });

        Wicket.Event.subscribe('/ajax/call/failure', function() {
            console.log('Wicket AJAX 調用失敗');
            hideLoadingIndicator();
            showErrorToast('操作失敗，請重試');
        });

        // 監聽 AJAX 回應處理
        Wicket.Event.subscribe('/ajax/call/after', function() {
            console.log('Wicket AJAX 回應處理完成');
        });

    } else {
        console.warn('Wicket 對象未找到，可能影響 AJAX 功能');
    }

    // 頁面聚焦和可見性事件處理
    $(window).on('focus', function() {
        setTimeout(function() {
            if ($('.student-item').length > 0 && $('.student-item.ui-draggable').length === 0) {
                console.log('頁面重新聚焦，重新初始化拖拽功能');
                safeReinit();
            }
        }, 100);
    });

    if (typeof document.visibilityState !== 'undefined') {
        document.addEventListener('visibilitychange', function() {
            if (!document.hidden) {
                setTimeout(function() {
                    if ($('.student-item').length > 0 && $('.student-item.ui-draggable').length === 0) {
                        console.log('頁面變為可見，重新初始化功能');
                        safeReinit();
                    }
                }, 300);
            }
        });
    }

    // DOM 變化監聽器 - 用於偵測動態內容更新
    if (typeof MutationObserver !== 'undefined') {
        var observer = new MutationObserver(function(mutations) {
            var needsReinit = false;

            mutations.forEach(function(mutation) {
                if (mutation.type === 'childList') {
                    // 檢查是否有新的學生項目被添加
                    $(mutation.addedNodes).each(function() {
                        if ($(this).hasClass && $(this).hasClass('student-item')) {
                            needsReinit = true;
                        }
                        if ($(this).find && $(this).find('.student-item').length > 0) {
                            needsReinit = true;
                        }
                    });
                }
            });

            if (needsReinit) {
                console.log('偵測到新的學生項目，重新初始化拖拽功能');
                setTimeout(function() {
                    safeReinit();
                }, 100);
            }
        });

        // 開始監聽
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        console.log('DOM 變化監聽器已啟動');
    }

    // 暴露函數到全域
    window.showModal = showModal;
    window.hideModal = hideModal;
    window.setDragDropCallbackUrl = setDragDropCallbackUrl;
    window.showSuccessToast = showSuccessToast;
    window.showErrorToast = showErrorToast;
    window.initDragAndDrop = initDragAndDrop;
    window.safeReinit = safeReinit;
    window.showLoadingIndicator = showLoadingIndicator;
    window.hideLoadingIndicator = hideLoadingIndicator;

    console.log('群組管理 JavaScript 模組載入完成');

})();