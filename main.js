const API_URL = 'https://nosy-general-cherry.glitch.me';
const socket = io(API_URL);
let currentReportId = null; // Ubah dari localStorage untuk menghindari masalah
let isTyping = false;
let typingTimeout;
let selectedImage = null; // Perbaiki nama variabel yang konsisten

// Check if there's an active report when page loads
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
                <form id="userMessageForm" onsubmit="sendUserMessage(event); return false;">
                    <label for="imageUpload" class="upload-image-btn" title="Kirim Foto">
                        📷
                        <input type="file" id="imageUpload" accept="image/*" style="display: none;" onchange="handleImageUpload(event)">
                    </label>
                    <input type="text" id="userMessageInput" placeholder="Ketik pesan..." oninput="handleTyping()">
                    <button type="submit" class="send-button" title="Kirim">
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

    // Add styles for new features
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
    
    // Clear previous timeout
    clearTimeout(typingTimeout);
    
    // Set new timeout
    typingTimeout = setTimeout(() => {
        isTyping = false;
        socket.emit('stop-typing', { reportId: currentReportId });
    }, 1000);
}

async function loadReportMessages(reportId) {
    try {
        const response = await fetch(`${API_URL}/api/reports/${reportId}`);
        if (!response.ok) {
            // Jika report tidak ditemukan (404), hapus reportId dari localStorage dan database
            localStorage.removeItem('currentReportId');
            // Coba hapus report di database (jaga-jaga jika masih ada)
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

    let imageHtml = '';
    if (data.image) {
        imageHtml = `
            <div class="message-image-container">
                <img src="${API_URL}${data.image}" 
                     alt="Shared image" 
                     class="message-image"
                     onclick="showFullscreenImage('${API_URL}${data.image}')">
            </div>
        `;
    }

    // Tambahkan header admin jika pesan dari admin
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

    const messageHtml = `
        ${adminHeader}
        <div class="message-content">
            ${imageHtml}
            <div class="message-text">${data.message}</div>
            <div class="message-footer">
                <span class="message-time">${new Date(data.createdAt).toLocaleTimeString('id-ID')}</span>
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

    // Upload gambar ke server
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

    // Emit pesan ke server
    socket.emit('send-message', messageData);
    
    // Reset form
    messageInput.value = '';
    if (selectedImage) {
        cancelImageUpload();
    }
}

// Update socket listener untuk new-message
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
    
    // Remove any existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach((notif, index) => {
        if (notif !== notification) {
            notif.style.top = `${(index + 1) * 80}px`;
        }
    });
    
    // Add closing animation after delay
    setTimeout(() => {
        notification.classList.add('closing');
        setTimeout(() => {
            notification.remove();
            // Reposition remaining notifications
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
        // Render ulang form report (bisa ambil dari index.html atau buat function renderReportForm())
        renderReportForm();
    }
}

function closeReportForm() {
    document.getElementById('reportModal').style.display = 'none';
    // Jangan hapus innerHTML modal-content!
    // currentReportId = null; // Hanya reset jika report selesai/closed
    // selectedImage = null;
    // localStorage.removeItem('currentReportId');
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

function createSnowflake() {
  const snowflake = document.createElement('div');
  snowflake.classList.add('snowflake');
  snowflake.innerHTML = '❅';
  snowflake.style.left = Math.random() * 100 + 'vw';
  snowflake.style.animationDuration = Math.random() * 3 + 2 + 's';
  snowflake.style.opacity = Math.random();
  snowflake.style.fontSize = Math.random() * 10 + 10 + 'px';
  
  document.body.appendChild(snowflake);
  
  setTimeout(() => {
    snowflake.remove();
  }, 5000);
}

setInterval(createSnowflake, 100);

// Tambahkan fungsi untuk menandai pesan admin sebagai telah dibaca
function markAdminMessagesAsRead() {
    const adminMessages = document.querySelectorAll('.message.admin');
    if (adminMessages.length > 0 && currentReportId) {
        socket.emit('messages-read', { reportId: currentReportId });
    }
}

// Panggil fungsi ini saat user membuka atau melihat chat
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        markAdminMessagesAsRead();
    }
});

function renderReportForm() {
    const modalContent = document.querySelector('.modal-content');
    modalContent.innerHTML = `
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
                    <span class="button-icon">→</span>
                </button>
            </form>
        </div>
    `;
}