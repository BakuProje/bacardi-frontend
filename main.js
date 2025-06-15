const API_URL = 'https://bacardi-report-api-b8957a8385db.herokuapp.com';
const socket = io(API_URL);
let currentReportId = null; 
let isTyping = false;
let typingTimeout;
let selectedImage = null; 

function formatDateTime(dateString) {
    const hari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const bulan = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    const date = new Date(dateString);
    const dayName = hari[date.getDay()];
    const day = date.getDate();
    const month = bulan[date.getMonth()];
    const year = date.getFullYear();
    const jam = date.getHours().toString().padStart(2, '0');
    const menit = date.getMinutes().toString().padStart(2, '0');
    return `${dayName}, ${day} ${month} ${year}, ${jam}:${menit}`;
}

window.addEventListener('load', () => {
    const storedReportId = localStorage.getItem('currentReportId');
    if (storedReportId) {
        currentReportId = storedReportId;
        socket.emit('join-report', currentReportId);
        showChatInterface();
        loadReportMessages(currentReportId);
    }
});

async function submitReport(event) {
    event.preventDefault();
    
    const growId = document.getElementById('growId').value;
    const category = document.getElementById('category').value;
    const complaint = document.getElementById('complaint').value;

    const submitButton = event.target.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    try {
        const response = await fetch(`${API_URL}/api/reports`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                growId,
                category,
                complaint
            })
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const data = await response.json();
        showNotification('Laporan berhasil dikirim!', 'success');
        currentReportId = data._id;
        localStorage.setItem('currentReportId', currentReportId);

        const adminResponse = {
            reportId: currentReportId,
            message: 'Admin Kami akan membalas Pesan mu. Silahkan Menunggu',
            isAdmin: true,
            createdAt: new Date()
        };
        appendMessage(adminResponse);

        const whatsappMessage = {
            reportId: currentReportId,
            message: 'Kalau mau chat Owner langsung silahkan klik di bawah ini',
            isAdmin: true,
            createdAt: new Date()
        };
        appendMessage(whatsappMessage);

       
        const whatsappButton = document.createElement('a');
        whatsappButton.href = 'https://api.whatsapp.com/send?phone=6281527641306&text=Welcome%20To%20Bacardi%20Support%0A%0AGrowid%3A%0ATanggal%3A${encodeURIComponent(formatDateTime(new Date()))}%0AMasalah%3A"';
        whatsappButton.className = 'whatsapp-button';
        whatsappButton.target = '_blank';
        whatsappButton.innerHTML = `
            <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" alt="WhatsApp" class="whatsapp-icon">
            Chat via WhatsApp
        `;

        const messagesDiv = document.getElementById('userMessages');
        if (messagesDiv) {
            messagesDiv.appendChild(whatsappButton);
        }
        
        showChatInterface();
        socket.emit('join-report', currentReportId);
        loadReportMessages(currentReportId);
        
        event.target.reset();
        
    } catch (error) {
        console.error('Error:', error);
        showNotification('Gagal mengirim laporan. Silakan coba lagi.', 'error');
    } finally {
        submitButton.disabled = false;
    }
}

function showChatInterface() {
    const modalContent = document.querySelector('.modal-content');
    modalContent.innerHTML = `
        <div class="chat-container">
            <div class="chat-header">
                <div class="chat-header-info">
                    <img src="./img/bacardi.png" alt="Bacardi Logo" class="chat-header-logo">
                    <h2>Chat dengan Admin</h2>
                </div>
                <span class="close" onclick="closeReportForm()">&times;</span>
            </div>
            <div class="chat-messages" id="userMessages"></div>
            <div id="typing-indicator" class="typing-indicator" style="display: none;">
                <span class="typing-text">Admin sedang mengetik...</span>
            </div>
            <div class="chat-input-container">
                <form id="userMessageForm" onsubmit="sendUserMessage(event); return false;" style="display: flex; align-items: center; gap: 8px;">
                    <label for="imageUpload" class="upload-image-btn" title="Kirim Foto" style="flex-shrink: 0;">
                        📷
                        <input type="file" id="imageUpload" accept="image/*" style="display: none;" onchange="handleImageUpload(event)">
                    </label>
                    <input type="text" id="userMessageInput" placeholder="Ketik pesan..." oninput="handleTyping()" style="flex: 1; min-width: 0;">
                    <button type="submit" class="send-button" title="Kirim" style="flex-shrink: 0;">
                        <span>➤</span>
                    </button>
                </form>
                <div id="imagePreview" class="image-preview" style="display: none;">
                    <img id="previewImg" src="" alt="Preview">
                    <button onclick="cancelImageUpload()" class="cancel-upload">×</button>
                </div>
            </div>
        </div>
    `;


    const style = document.createElement('style');
    style.textContent = `
        .typing-indicator {
            padding: 10px 20px;
            color: #8696a0;
            font-size: 12px;
            font-style: italic;
        }
        
        .message-status {
            display: inline-block;
            margin-left: 4px;
            font-size: 14px;
            color: #8696a0;
        }
        
        .message-status.read {
            color: #53bdeb;
        }
        
        @keyframes blink {
            0% { opacity: .2; }
            20% { opacity: 1; }
            100% { opacity: .2; }
        }
        
        .typing-text span {
            animation-name: blink;
            animation-duration: 1.4s;
            animation-iteration-count: infinite;
            animation-fill-mode: both;
        }
        
        .typing-text span:nth-child(2) { animation-delay: .2s; }
        .typing-text span:nth-child(3) { animation-delay: .4s; }

        .upload-image-btn {
            padding: 10px;
            background: rgba(33, 150, 243, 0.1);
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s ease;
        }

        .upload-image-btn:hover {
            background: rgba(33, 150, 243, 0.2);
        }

        .image-preview {
            padding: 10px;
            background: rgba(33, 150, 243, 0.05);
            border-radius: 8px;
            margin-top: 10px;
            position: relative;
        }

        .image-preview img {
            max-width: 200px;
            max-height: 200px;
            border-radius: 8px;
        }

        .cancel-upload {
            position: absolute;
            top: 5px;
            right: 5px;
            background: rgba(255, 0, 0, 0.8);
            color: white;
            border: none;
            border-radius: 50%;
            width: 24px;
            height: 24px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .message-image {
            max-width: 200px;
            max-height: 200px;
            border-radius: 8px;
            margin-top: 8px;
            cursor: pointer;
            transition: transform 0.3s ease;
        }

        .message-image:hover {
            transform: scale(1.05);
        }

        .fullscreen-image {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.9);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        }

        .fullscreen-image img {
            max-width: 90%;
            max-height: 90%;
        }
    `;
    document.head.appendChild(style);
}

function handleTyping() {
    if (!isTyping) {
        isTyping = true;
        socket.emit('typing', { reportId: currentReportId });
    }
    
    clearTimeout(typingTimeout);
    
    typingTimeout = setTimeout(() => {
        isTyping = false;
        socket.emit('stop-typing', { reportId: currentReportId });
    }, 1000);
}

async function loadReportMessages(reportId) {
    try {
        const response = await fetch(`${API_URL}/api/reports/${reportId}`);
        if (!response.ok) {
            localStorage.removeItem('currentReportId');
            await fetch(`${API_URL}/api/reports/${reportId}`, { method: 'DELETE' });
            showNotification('Report tidak ditemukan, data akan direset.', 'error');
            closeReportForm();
            return;
        }
        const report = await response.json();
        if (report.status === 'resolved') {
            localStorage.removeItem('currentReportId');
            closeReportForm();
            return;
        }
        const messagesDiv = document.getElementById('userMessages');
        if (messagesDiv) {
            messagesDiv.innerHTML = '';
            if (report && Array.isArray(report.responses)) {
                report.responses.forEach(response => {
                    appendMessage({
                        ...response,
                        reportId: report._id
                    });
                });
                messagesDiv.scrollTop = messagesDiv.scrollHeight;
            } else {
                showNotification('Data report tidak valid atau tidak ditemukan', 'error');
            }
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('Gagal memuat pesan', 'error');
    }
}
function appendMessage(data) {
    const messagesDiv = document.getElementById('userMessages');
    if (!messagesDiv) return;

    const messageId = `${new Date(data.createdAt).getTime()}-${data.message}`;
    if (document.querySelector(`[data-message-id="${messageId}"]`)) return;

    const messageElement = document.createElement('div');
    messageElement.className = `message ${data.isAdmin ? 'admin' : 'user'}`;
    messageElement.setAttribute('data-message-id', messageId);

    let adminHeader = '';
    if (data.isAdmin) {
        const avatar = data.adminAvatar ? data.adminAvatar : './img/bacardi.png';
        const name = data.adminName ? data.adminName : 'Admin Bacardi';
        adminHeader = `
            <div class="admin-header">
                <img src="${avatar}" alt="Admin Logo" class="admin-logo">
                <span class="admin-name">${name}</span>
            </div>
        `;
    }

    let whatsappButton = '';
    if (data.message === 'Kalau mau chat Owner langsung silahkan klik di bawah ini' || data.isWhatsAppButton) {
        whatsappButton = `
            <div class="whatsapp-button-container" style="margin-top: 10px;">
                <a href="https://api.whatsapp.com/send?phone=6281527641306&text=Welcome%20To%20Bacardi%20Support%0A%0AGrowid%3A%0ATanggal%3A${encodeURIComponent(formatDateTime(new Date()))}%0AMasalah%3A" 
                   class="whatsapp-button" 
                   target="_blank"
                   style="display: inline-flex; align-items: center; background-color: #25D366; color: white; padding: 8px 15px; border-radius: 20px; text-decoration: none; font-size: 14px; margin-top: 8px;">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" 
                         alt="WhatsApp" 
                         style="width: 20px; height: 20px; margin-right: 8px;">
                    <span>Chat via WhatsApp</span>
                </a>
            </div>
        `;
    }

    let imageHtml = '';
    if (data.image) {
        let imgSrc = data.image.startsWith('http') ? data.image : API_URL + data.image;
        imageHtml = `
            <div class="message-image-container">
                <img src="${imgSrc}" alt="Shared image" class="message-image" onclick="showFullscreenImage('${imgSrc}')">
            </div>
        `;
    }

    const messageHtml = `
        ${adminHeader}
        <div class="message-content" style="padding: 12px 16px; border-radius: 16px; margin-bottom: 8px; background: ${data.isAdmin ? 'rgba(33, 150, 243, 0.15)' : 'rgba(33, 150, 243, 0.25)'};">
            ${imageHtml}
            <div class="message-text">${data.message}</div>
            ${whatsappButton}
            <div class="message-footer" style="margin-top: 8px; text-align: right; font-size: 0.75rem; color: rgba(255, 255, 255, 0.6);">
                ${formatDateTime(data.createdAt)}
            </div>
        </div>
    `;

    messageElement.innerHTML = messageHtml;
    messagesDiv.appendChild(messageElement);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}
async function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        showNotification('Hanya file gambar yang diperbolehkan!', 'error');
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        showNotification('Ukuran file maksimal 5MB!', 'error');
        return;
    }

    const preview = document.getElementById('imagePreview');
    const previewImg = document.getElementById('previewImg');
    
    const reader = new FileReader();
    reader.onload = function(e) {
        previewImg.src = e.target.result;
        preview.style.display = 'block';
    }
    reader.readAsDataURL(file);

    const formData = new FormData();
    formData.append('image', file);

    try {
        const response = await fetch(`${API_URL}/api/upload`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) throw new Error('Upload failed');

        const data = await response.json();
        selectedImage = data.path;
    } catch (error) {
        console.error('Error uploading image:', error);
        showNotification('Gagal mengupload gambar', 'error');
        cancelImageUpload();
    }
}

function cancelImageUpload() {
    selectedImage = null;
    const preview = document.getElementById('imagePreview');
    const previewImg = document.getElementById('previewImg');
    if (preview) preview.style.display = 'none';
    if (previewImg) previewImg.src = '';
    const imageUpload = document.getElementById('imageUpload');
    if (imageUpload) imageUpload.value = '';
}

function showFullscreenImage(src) {
    const fullscreenDiv = document.createElement('div');
    fullscreenDiv.className = 'fullscreen-image';
    fullscreenDiv.innerHTML = `<img src="${src}" alt="Fullscreen image">`;
    fullscreenDiv.onclick = () => fullscreenDiv.remove();
    document.body.appendChild(fullscreenDiv);
}

async function sendUserMessage(e) {
    e.preventDefault();
    const messageInput = document.getElementById('userMessageInput');
    const message = messageInput.value.trim();
    if (!message && !selectedImage) {
        return;
    }
    if (!currentReportId) {
        showNotification('Tidak ada sesi chat aktif. Silakan buat report baru.', 'error');
        return;
    }

    const messageData = {
        reportId: currentReportId,
        message: message || (selectedImage ? 'Mengirim gambar' : ''),
        image: selectedImage,
        isAdmin: false,
        createdAt: new Date()
    };

    socket.emit('send-message', messageData);
    
    messageInput.value = '';
    if (selectedImage) {
        cancelImageUpload();
    }
}

socket.on('new-message', (data) => {
    if (data.reportId === currentReportId) {
        appendMessage(data);
    }
});

socket.on('typing', (data) => {
    const typingIndicator = document.getElementById('typing-indicator');
    if (typingIndicator) {
        typingIndicator.innerHTML = `
            <span class="typing-text">
                Admin sedang mengetik<span>.</span><span>.</span><span>.</span>
            </span>
        `;
        typingIndicator.style.display = 'block';
    }
});

socket.on('stop-typing', () => {
    const typingIndicator = document.getElementById('typing-indicator');
    if (typingIndicator) {
        typingIndicator.style.display = 'none';
    }
});

socket.on('message-read', (data) => {
    const userMessages = document.querySelectorAll('.message.user');
    userMessages.forEach(message => {
        const statusElement = message.querySelector('.message-status');
        if (statusElement) {
            statusElement.className = 'message-status read';
            statusElement.textContent = '✓✓';
        }
    });
});

socket.on('report-closed', (data) => {
    if (data.reportId === currentReportId) {
        localStorage.removeItem('currentReportId');
        showNotification('Report telah ditutup oleh admin', 'info');
        closeReportForm();
    }
});

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            ${message}
        </div>
    `;
    
    document.body.appendChild(notification);
    
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach((notif, index) => {
        if (notif !== notification) {
            notif.style.top = `${(index + 1) * 80}px`;
        }
    });
    
    setTimeout(() => {
        notification.classList.add('closing');
        setTimeout(() => {
            notification.remove();
            document.querySelectorAll('.notification').forEach((notif, index) => {
                notif.style.top = `${24 + index * 80}px`;
            });
        }, 500);
    }, 3000);
}

function openReportForm() {
    const modal = document.getElementById('reportModal');
    modal.style.display = 'block';
    const modalContent = document.querySelector('.modal-content');
    const storedReportId = localStorage.getItem('currentReportId');
    if (storedReportId) {
        currentReportId = storedReportId;
        showChatInterface();
        socket.emit('join-report', currentReportId);
        loadReportMessages(currentReportId);
    } else {        
        renderReportForm();
    }
}

function closeReportForm() {
    document.getElementById('reportModal').style.display = 'none';
}

window.onclick = function(event) {
    const modal = document.getElementById('reportModal');
    if (event.target == modal) {
        closeReportForm();
    }
}

socket.on('connect', () => {
    console.log('Connected to server');
    showNotification('Welcome Bacardi Support', 'success');
});

socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
    showNotification('Bacardi Support Maintenance', 'error');
});

const chatStyles = `
    .chat-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: #111b21;
    }
    
    .chat-header {
        padding: 15px;
        background: #202c33;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #374045;
    }
    
    .chat-messages {
        flex: 1;
        padding: 20px;
        overflow-y: auto;
        background: #0b141a;
    }
    
    .chat-input-container {
        padding: 15px;
        background: #202c33;
        border-top: 1px solid #374045;
    }
    
    #userMessageForm {
        display: flex;
        gap: 10px;
    }
    
    #userMessageInput {
        flex: 1;
        padding: 12px;
        border: none;
        border-radius: 8px;
        background: #2a3942;
        color: #e9edef;
        font-size: 14px;
    }
    
    #userMessageInput:focus {
        outline: none;
    }
    
    .send-button {
        background: #00a884;
        color: #fff;
        border: none;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    
    .message {
        margin-bottom: 15px;
        max-width: 70%;
    }
    
    .message.user {
        margin-left: auto;
    }
    
    .message.admin {
        margin-right: auto;
    }
    
    .message-content {
        padding: 8px 12px;
        border-radius: 8px;
        font-size: 14px;
        line-height: 1.4;
    }
    
    .message.user .message-content {
        background: #005c4b;
        color: #e9edef;
    }
    
    .message.admin .message-content {
        background: #202c33;
        color: #e9edef;
    }
    
    .message-time {
        font-size: 11px;
        color: #8696a0;
        margin-top: 4px;
        text-align: right;
    }
`;

document.addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style');
    style.textContent = chatStyles;
    document.head.appendChild(style);
});

function markAdminMessagesAsRead() {
    const adminMessages = document.querySelectorAll('.message.admin');
    if (adminMessages.length > 0 && currentReportId) {
        socket.emit('messages-read', { reportId: currentReportId });
    }
}

document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        markAdminMessagesAsRead();
    }
});

function renderReportForm() {
    const modalContent = document.querySelector('.modal-content');
    modalContent.innerHTML = `
        <span class="close" onclick="closeReportForm()">&times;</span>
        <div class="report-form-modern">
            <div class="chat-header">
                <div class="chat-header-info">
                    <img src="./img/bacardi.png" alt="Bacardi Logo" class="chat-header-logo">
                    <h2>Player Report</h2>
                </div>
                <span class="close" onclick="closeReportForm()">&times;</span>
            </div>
            <h2 class="report-title">Report Masalah</h2>
            <form id="reportForm" onsubmit="submitReport(event)">
                <div class="form-group">
                    <label for="growId">Grow ID</label>
                    <input type="text" id="growId" required placeholder="Masukkan Grow ID Anda">
                </div>
                <div class="form-group">
                    <label for="category">Kategori Masalah</label>
                    <select id="category" required>
                        <option value="">Pilih Kategori</option>
                        <option value="Curse Wand">Curse Wand</option>
                        <option value="BedRock">BedRock</option>
                        <option value="Staff Jail">Staff Jail</option>
                        <option value="Banned Sembarangan">Banned Sembarangan</option>
                        <option value="Banned">Banned</option>
                        <option value="Scam">Scam</option>
                        <option value="Player Bermasalah">Player Bermasalah</option>
                        <option value="Other">Other</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="complaint">Keluhan</label>
                    <textarea id="complaint" required placeholder="Jelaskan masalah Anda secara detail..."></textarea>
                </div>
                <button type="submit" class="submit-button">
                    <span class="button-text">Kirim Report</span>
                    <span class="button-icon"></span>
                </button>
            </form>
        </div>
    `;
}