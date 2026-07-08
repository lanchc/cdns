 (function() {
     if (window._cat_catch_injected) return;
     window._cat_catch_injected = true;

     console.log('[Sniffer] Content script injected successfully!');

     const isTopWindow = (window.top === window.self);
     const detectedUrls = new Set();
     let currentVideoUrl = null;
     let currentVideoTitle = null;
     let buttonElement = null;
     let badgeElement = null;

     // 检测环境
     const isWKWebView = !!(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.sniffer);
     const isSafariExtension = !isWKWebView && (typeof safari !== 'undefined' || typeof browser !== 'undefined');

     // ---------- 获取顶层网页标题 ----------
     function getTopLevelTitle() {
         try {
             if (window.top && window.top.document && window.top.document.title) {
                 return window.top.document.title;
             }
         } catch (e) {}
         return document.title || '视频';
     }

     // ---------- 创建主按钮（仅 Safari 扩展顶层）----------
     function createMainButton() {
         if (!isTopWindow || isWKWebView) return null;
         if (buttonElement) return buttonElement;

         const btn = document.createElement('div');
         btn.id = 'sniffer-main-btn';
         btn.style.cssText = `
             position: fixed;
             bottom: 30px;
             right: 30px;
             width: 56px;
             height: 56px;
             border-radius: 50%;
             background: rgba(0, 122, 255, 0.9);
             box-shadow: 0 4px 12px rgba(0,0,0,0.3);
             display: flex;
             align-items: center;
             justify-content: center;
             font-size: 28px;
             color: #fff;
             cursor: pointer;
             z-index: 2147483647;
             user-select: none;
             transition: transform 0.2s ease;
             border: 2px solid rgba(255,255,255,0.3);
         `;
         btn.textContent = '🎬';
         btn.title = '点击查看/捕获视频';
         document.documentElement.appendChild(btn);

         const badge = document.createElement('div');
         badge.id = 'sniffer-badge';
         badge.style.cssText = `
             position: absolute;
             top: -4px;
             right: -4px;
             width: 14px;
             height: 14px;
             border-radius: 50%;
             background: #ff3b30;
             border: 2px solid white;
             display: none;
             box-shadow: 0 1px 3px rgba(0,0,0,0.3);
         `;
         btn.appendChild(badge);
         badgeElement = badge;

         btn.addEventListener('click', (e) => {
             e.stopPropagation();
             if (badgeElement) badgeElement.style.display = 'none';
             showActionSheet();
         });

         buttonElement = btn;
         console.log('[Sniffer] 右下角按钮已创建');
         return btn;
     }

     function showBadge() {
         if (badgeElement) {
             badgeElement.style.display = 'block';
         }
     }

     // ---------- 菜单（仅 Safari 扩展）----------
     function showActionSheet() {
         if (!isTopWindow || isWKWebView) return;
         const oldSheet = document.getElementById('sniffer-action-sheet');
         if (oldSheet) oldSheet.remove();

         const overlay = document.createElement('div');
         overlay.id = 'sniffer-action-sheet';
         overlay.style.cssText = `
             position: fixed;
             bottom: 0;
             left: 0;
             right: 0;
             background: rgba(0,0,0,0.5);
             z-index: 2147483647;
             display: flex;
             justify-content: center;
             align-items: flex-end;
             animation: snifferFadeIn 0.25s ease;
         `;

         const sheet = document.createElement('div');
         sheet.style.cssText = `
             background: #1c1c1e;
             color: #fff;
             width: 100%;
             max-width: 500px;
             border-radius: 18px 18px 0 0;
             padding: 20px 24px 30px;
             box-shadow: 0 -4px 20px rgba(0,0,0,0.5);
             font-family: -apple-system, BlinkMacSystemFont, sans-serif;
             font-size: 15px;
             transform: translateY(100%);
             transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
         `;

         const title = document.createElement('div');
         title.style.cssText = `text-align:center;font-weight:600;font-size:16px;padding-bottom:12px;border-bottom:1px solid #3a3a3c;margin-bottom:16px;`;
         title.textContent = '🎬 视频地址';

         const urlContainer = document.createElement('div');
         urlContainer.style.cssText = `
             background: #2c2c2e;
             border-radius: 10px;
             padding: 12px 14px;
             margin-bottom: 20px;
             max-height: 120px;
             overflow-y: auto;
             word-break: break-all;
             font-size: 13px;
             color: #e5e5e5;
             font-family: monospace;
         `;
         urlContainer.textContent = currentVideoUrl || '尚未捕获到视频地址';

         const btnGroup = document.createElement('div');
         btnGroup.style.cssText = `display:flex;flex-direction:column;gap:12px;`;

         const rescanBtn = document.createElement('button');
         rescanBtn.textContent = '🔄 重新扫描';
         rescanBtn.style.cssText = `
             background: #ff9500;
             color: #fff;
             border: none;
             border-radius: 12px;
             padding: 14px 0;
             font-size: 16px;
             font-weight: 600;
             cursor: pointer;
             transition: opacity 0.2s;
         `;
         rescanBtn.addEventListener('click', () => {
             scanAll();
             showToast('重新扫描完成');
         });

         const downloadBtn = document.createElement('button');
         downloadBtn.textContent = '⬇️ 跳转 App 下载';
         downloadBtn.style.cssText = `
             background: #007aff;
             color: #fff;
             border: none;
             border-radius: 12px;
             padding: 14px 0;
             font-size: 16px;
             font-weight: 600;
             cursor: pointer;
             transition: opacity 0.2s;
         `;
         downloadBtn.addEventListener('click', () => {
             if (currentVideoUrl) {
                 openAppWithVideo(currentVideoUrl, currentVideoTitle);
                 closeActionSheet();
             } else {
                 showToast('暂无视频地址');
             }
         });

         const copyBtn = document.createElement('button');
         copyBtn.textContent = '📋 复制地址';
         copyBtn.style.cssText = `
             background: #3a3a3c;
             color: #fff;
             border: none;
             border-radius: 12px;
             padding: 14px 0;
             font-size: 16px;
             font-weight: 600;
             cursor: pointer;
             transition: opacity 0.2s;
         `;
         copyBtn.addEventListener('click', () => {
             if (currentVideoUrl) {
                 copyToClipboard(currentVideoUrl);
                 closeActionSheet();
             } else {
                 showToast('暂无视频地址');
             }
         });

         const cancelBtn = document.createElement('button');
         cancelBtn.textContent = '取消';
         cancelBtn.style.cssText = `
             background: transparent;
             color: #8e8e93;
             border: none;
             border-radius: 12px;
             padding: 14px 0;
             font-size: 15px;
             font-weight: 500;
             cursor: pointer;
             margin-top: 4px;
         `;
         cancelBtn.addEventListener('click', closeActionSheet);

         btnGroup.appendChild(rescanBtn);
         btnGroup.appendChild(downloadBtn);
         btnGroup.appendChild(copyBtn);
         btnGroup.appendChild(cancelBtn);

         sheet.appendChild(title);
         sheet.appendChild(urlContainer);
         sheet.appendChild(btnGroup);
         overlay.appendChild(sheet);

         overlay.addEventListener('click', (e) => {
             if (e.target === overlay) closeActionSheet();
         });

         document.documentElement.appendChild(overlay);
         requestAnimationFrame(() => {
             sheet.style.transform = 'translateY(0)';
         });

         window._snifferCloseSheet = function() {
             sheet.style.transform = 'translateY(100%)';
             setTimeout(() => {
                 if (overlay.parentNode) overlay.remove();
             }, 300);
         };
     }

     function closeActionSheet() {
         if (window._snifferCloseSheet) window._snifferCloseSheet();
         else {
             const sheet = document.getElementById('sniffer-action-sheet');
             if (sheet) sheet.remove();
         }
     }

     // ---------- 跳转 App（仅 Safari 扩展）----------
     function openAppWithVideo(videoUrl, videoTitle) {
         copyToClipboard(videoUrl, false);
         let scheme = `videosniffer://download?url=${encodeURIComponent(videoUrl)}`;
         if (videoTitle) scheme += `&title=${encodeURIComponent(videoTitle)}`;
         try {
             const link = document.createElement('a');
             link.href = scheme;
             link.style.display = 'none';
             link.target = '_top';
             document.documentElement.appendChild(link);
             link.click();
             setTimeout(() => document.documentElement.removeChild(link), 200);
         } catch (e) {}
         setTimeout(() => { try { window.location.href = scheme; } catch(e) {} }, 100);
         setTimeout(() => { try { window.open(scheme, '_top'); } catch(e) {} }, 200);
         setTimeout(() => { try { window.location.replace(scheme); } catch(e) {} }, 300);
         showToast('正在跳转App... 剪贴板已备份地址');
     }

     function copyToClipboard(text, showToastMsg = true) {
         try {
             if (navigator.clipboard && navigator.clipboard.writeText) {
                 navigator.clipboard.writeText(text).then(() => {
                     if (showToastMsg) showToast('✅ 已复制链接');
                 }).catch(() => fallbackCopy(text, showToastMsg));
             } else {
                 fallbackCopy(text, showToastMsg);
             }
         } catch (e) {
             fallbackCopy(text, showToastMsg);
         }
     }

     function fallbackCopy(text, showToastMsg) {
         const textarea = document.createElement('textarea');
         textarea.value = text;
         textarea.style.position = 'fixed';
         textarea.style.opacity = '0';
         textarea.style.left = '-9999px';
         document.documentElement.appendChild(textarea);
         textarea.select();
         try {
             document.execCommand('copy');
             if (showToastMsg) showToast('✅ 已复制链接');
         } catch (e) {
             if (showToastMsg) showToast('❌ 复制失败，请手动复制');
         }
         document.documentElement.removeChild(textarea);
     }

     function showToast(msg) {
         if (isWKWebView || !isTopWindow) return;
         const existing = document.getElementById('sniffer-toast');
         if (existing) existing.remove();
         const toast = document.createElement('div');
         toast.id = 'sniffer-toast';
         toast.textContent = msg;
         toast.style.cssText = `
             position: fixed;
             bottom: 100px;
             left: 50%;
             transform: translateX(-50%);
             background: rgba(0,0,0,0.75);
             color: #fff;
             padding: 8px 20px;
             border-radius: 20px;
             font-size: 14px;
             z-index: 2147483647;
             font-family: -apple-system, sans-serif;
             pointer-events: none;
             white-space: nowrap;
             backdrop-filter: blur(4px);
             box-shadow: 0 4px 12px rgba(0,0,0,0.3);
         `;
         document.documentElement.appendChild(toast);
         setTimeout(() => toast.remove(), 2500);
     }

     // ========== 核心嗅探逻辑 ==========

     // ---------- 发送消息到原生（兼容所有环境）----------
     function sendToNative(url, title) {
         const message = { url: url, title: title || getTopLevelTitle() };

         // 1. WKWebView
         if (isWKWebView) {
             try {
                 window.webkit.messageHandlers.sniffer.postMessage(message);
                 console.log('[Sniffer] ✅ 发送到 WKWebView:', url);
                 return;
             } catch (e) {
                 console.warn('[Sniffer] WKWebView 发送失败:', e);
             }
         }

         // 2. Safari 扩展 (使用 safari.runtime)
         if (typeof safari !== 'undefined' && safari.runtime && safari.runtime.sendNativeMessage) {
             try {
                 safari.runtime.sendNativeMessage('com.lucky.VideoSniffer', message);
                 console.log('[Sniffer] ✅ 发送到 Safari Native:', url);
                 return;
             } catch (e) {
                 console.warn('[Sniffer] Safari sendNativeMessage 失败:', e);
             }
         }

         // 3. Safari 扩展 (使用 browser.runtime)
         if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.sendNativeMessage) {
             try {
                 browser.runtime.sendNativeMessage('com.lucky.VideoSniffer', message);
                 console.log('[Sniffer] ✅ 发送到 Browser Native:', url);
                 return;
             } catch (e) {
                 console.warn('[Sniffer] Browser sendNativeMessage 失败:', e);
             }
         }

         // 4. 备用：通过 postMessage 到顶层（跨 frame）
         if (!isTopWindow) {
             window.top.postMessage({ type: 'sniffer-video', url: url, title: title || getTopLevelTitle() }, '*');
         }

         console.warn('[Sniffer] 无法发送消息到原生:', url);
     }

     // ---------- 更新视频地址 ----------
     function updateVideoUrl(url, title) {
         if (!url || !url.startsWith('http')) return;
         if (detectedUrls.has(url)) return;
         detectedUrls.add(url);

         // 发送到原生
         sendToNative(url, title);

         // 如果是 Safari 扩展顶层，更新 UI
         if (!isWKWebView && isTopWindow) {
             currentVideoUrl = url;
             currentVideoTitle = title || getTopLevelTitle();
             showBadge();
             if (!buttonElement) createMainButton();
             console.log('[Sniffer] ✅ 捕获到视频地址:', url);
         }
     }

     function sendUrlToApp(url, type = 'video') {
         const title = getTopLevelTitle();
         updateVideoUrl(url, title);
     }

     // ---------- 1. DOM 扫描 ----------
     function scanDOM() {
         document.querySelectorAll('video').forEach(v => {
             const src = v.src || v.currentSrc;
             if (src && src.startsWith('http')) sendUrlToApp(src, 'video');
             v.querySelectorAll('source').forEach(s => {
                 if (s.src && s.src.startsWith('http')) sendUrlToApp(s.src, 'video');
             });
         });
         document.querySelectorAll('source').forEach(s => {
             if (s.src && s.src.startsWith('http')) sendUrlToApp(s.src, 'video');
         });
         document.querySelectorAll('a[href*=".m3u8"], a[href*=".mpd"]').forEach(a => {
             if (a.href && a.href.startsWith('http')) sendUrlToApp(a.href, 'stream');
         });
         const pattern = /https?:\/\/[^\s"']+\.(m3u8|mpd)(\?[^\s"']*)?/gi;
         const allEls = document.querySelectorAll('*');
         for (let el of allEls) {
             const text = el.textContent;
             if (text) {
                 const matches = text.match(pattern);
                 if (matches) {
                     matches.forEach(url => {
                         if (url.startsWith('http')) sendUrlToApp(url, 'stream');
                     });
                 }
             }
         }
     }

     // ---------- 2. 网络请求拦截 ----------
     const originalOpen = XMLHttpRequest.prototype.open;
     XMLHttpRequest.prototype.open = function(method, url, ...rest) {
         if (url && typeof url === 'string') {
             const lower = url.toLowerCase();
             if (lower.includes('.m3u8') || lower.includes('.mpd')) {
                 sendUrlToApp(url, 'stream');
             }
         }
         return originalOpen.call(this, method, url, ...rest);
     };

     const originalFetch = window.fetch;
     if (originalFetch) {
         window.fetch = function(input, init) {
             let url = typeof input === 'string' ? input : (input.url || '');
             if (url) {
                 const lower = url.toLowerCase();
                 if (lower.includes('.m3u8') || lower.includes('.mpd')) {
                     sendUrlToApp(url, 'stream');
                 }
             }
             return originalFetch.call(this, input, init);
         };
     }

     // ---------- 3. MediaSource 拦截 ----------
     if (typeof MediaSource !== 'undefined') {
         const originalAddSourceBuffer = MediaSource.prototype.addSourceBuffer;
         MediaSource.prototype.addSourceBuffer = function(mimeType) {
             const sourceBuffer = originalAddSourceBuffer.call(this, mimeType);
             const originalAppend = sourceBuffer.appendBuffer;
             sourceBuffer.appendBuffer = function(data) {
                 setTimeout(scanAll, 50);
                 return originalAppend.call(this, data);
             };
             return sourceBuffer;
         };
     }

     // ---------- 4. JS 运行时监控 ----------
     const originalJSONParse = JSON.parse;
     JSON.parse = function(text, reviver) {
         const result = originalJSONParse.call(this, text, reviver);
         try {
             const jsonStr = typeof result === 'object' ? JSON.stringify(result) : String(result);
             const matches = jsonStr.match(/https?:\/\/[^\s"']+\.(m3u8|mpd)/i);
             if (matches) {
                 sendUrlToApp(matches[0], 'stream');
             }
         } catch (e) {}
         return result;
     };

     const originalAtob = window.atob;
     window.atob = function(str) {
         const result = originalAtob.call(this, str);
         try {
             const matches = result.match(/https?:\/\/[^\s"']+\.(m3u8|mpd)/i);
             if (matches) {
                 sendUrlToApp(matches[0], 'stream');
             }
         } catch (e) {}
         return result;
     };

     const originalCreateObjectURL = URL.createObjectURL;
     URL.createObjectURL = function(blob) {
         const url = originalCreateObjectURL.call(this, blob);
         setTimeout(scanAll, 100);
         return url;
     };

     // ---------- 5. 全面扫描 ----------
     function scanAll() {
         scanDOM();
     }

     // ---------- 6. 跨 frame 通信（仅 Safari 扩展顶层）----------
     if (isTopWindow && !isWKWebView) {
         window.addEventListener('message', (event) => {
             if (event.data && event.data.type === 'sniffer-video') {
                 const { url, title } = event.data;
                 if (url && url.startsWith('http')) {
                     if (!detectedUrls.has(url)) {
                         detectedUrls.add(url);
                         currentVideoUrl = url;
                         currentVideoTitle = title || getTopLevelTitle();
                         showBadge();
                         console.log('[Sniffer] ✅ 收到子 frame 视频地址:', url);
                         if (!buttonElement) createMainButton();
                     }
                 }
             }
         });
     }

     // ---------- 7. 初始化 ----------
     if (isTopWindow && !isWKWebView) {
         createMainButton();
         showToast('🎬 视频嗅探已启动');
     }

     setTimeout(scanAll, 2000);
     if (document.readyState === 'complete') {
         setTimeout(scanAll, 500);
     } else {
         window.addEventListener('load', () => setTimeout(scanAll, 500));
         document.addEventListener('DOMContentLoaded', () => setTimeout(scanAll, 1000));
     }

     setInterval(scanAll, 2000);

     const observer = new MutationObserver(() => {
         clearTimeout(window._snifferScanTimer);
         window._snifferScanTimer = setTimeout(scanAll, 300);
     });
     observer.observe(document.documentElement, {
         childList: true,
         subtree: true,
         attributes: true,
         attributeFilter: ['src', 'currentSrc', 'href']
     });

     console.log('[Sniffer] 已注入');
     console.log('[Sniffer] 环境:', isWKWebView ? 'WKWebView' : 'Safari扩展');
     console.log('[Sniffer] 当前页面 URL:', window.location.href);
 })();
