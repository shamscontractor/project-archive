// اتصال به Supabase
const supabaseUrl = 'https://aoltsblnjgcvknpgozsn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvbHRzYmxuamdjdmtucGdvenNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU2Mjg1MTIsImV4cCI6MjA2MTIwNDUxMn0.fa5uKurrCH1jpQJfeUjscRQLsLG2q3moH4ikadX4Z4g';
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

// وضعیت ورود
let userRole = '';
let currentFolderId = null;
let breadcrumb = [];

// رمزهای ورود
const adminPassword = '2487474';
const viewerPassword = 'Karandarya';

// لاگ فعالیت‌ها
let activities = [];

// ورود کاربر
function login() {
  const password = document.getElementById('passwordInput').value;
  if (password === adminPassword) {
    userRole = 'admin';
    document.getElementById('welcomeMessage').textContent = '👋 خوش آمدید مدیر عزیز!';
    afterLogin();
  } else if (password === viewerPassword) {
    userRole = 'viewer';
    document.getElementById('welcomeMessage').textContent = '👀 شما به عنوان مشاهده‌کننده وارد شده‌اید.';
    afterLogin();
  } else {
    document.getElementById('loginError').textContent = 'رمز عبور اشتباه است.';
  }
}

function afterLogin() {
  document.getElementById('loginContainer').classList.add('hidden');
  document.getElementById('appContainer').classList.remove('hidden');
  if (userRole === 'admin') {
    document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
  }
  loadFolders();
}

// بارگذاری دسته‌ها و فایل‌ها
async function loadFolders() {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('parent_id', currentFolderId);

  if (error) {
    console.error(error);
    return;
  }

  renderItems(data);
}

// نمایش آیتم‌ها
function renderItems(items) {
  const folderList = document.getElementById('folderList');
  const fileList = document.getElementById('fileList');
  folderList.innerHTML = '';
  fileList.innerHTML = '';

  const search = document.getElementById('searchInput').value.toLowerCase();
  const sortType = document.getElementById('sortSelect').value;

  let folders = items.filter(item => item.type === 'folder');
  let files = items.filter(item => item.type === 'file');

  if (search) {
    folders = folders.filter(item => item.name.toLowerCase().includes(search));
    files = files.filter(item => item.name.toLowerCase().includes(search));
  }

  if (sortType === 'alphabetical') {
    folders.sort((a, b) => a.name.localeCompare(b.name));
    files.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    folders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    files.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  folders.forEach(folder => {
    const div = document.createElement('div');
    div.className = 'item';
    div.innerHTML = `${folder.name} ${userRole === 'admin' ? '<button onclick="deleteItem(\''+folder.id+'\', \'folder\')">🗑</button>' : ''}`;
    div.onclick = () => openFolder(folder.id, folder.name);
    folderList.appendChild(div);
  });

  files.forEach(file => {
    const div = document.createElement('div');
    div.className = 'item';
    div.innerHTML = `<a href="${file.file_url}" download target="_blank">${file.name} (${(file.size / (1024*1024)).toFixed(2)}MB)</a> ${userRole === 'admin' ? '<button onclick="deleteItem(\''+file.id+'\', \'file\')">🗑</button>' : ''}`;
    fileList.appendChild(div);
  });
}

// باز کردن پوشه
function openFolder(folderId, folderName) {
  currentFolderId = folderId;
  breadcrumb.push({ id: folderId, name: folderName });
  updateBreadcrumb();
  loadFolders();
}

// بروز رسانی مسیر (breadcrumb)
function updateBreadcrumb() {
  const breadcrumbDiv = document.getElementById('breadcrumb');
  breadcrumbDiv.innerHTML = breadcrumb.map(crumb => crumb.name).join(' / ');
}

// بازگشت به پوشه قبلی
function goBack() {
  breadcrumb.pop();
  if (breadcrumb.length > 0) {
    currentFolderId = breadcrumb[breadcrumb.length - 1].id;
  } else {
    currentFolderId = null;
  }
  updateBreadcrumb();
  loadFolders();
}

// افزودن دسته‌بندی جدید
async function addFolder() {
  const name = document.getElementById('newFolderName').value;
  if (!name) return alert('نام دسته‌بندی را وارد کنید.');

  const { error } = await supabase.from('documents').insert([{
    name: name,
    type: 'folder',
    parent_id: currentFolderId
  }]);

  if (error) {
    console.error(error);
  } else {
    alert('✅ دسته‌بندی جدید اضافه شد');
    activities.push(`📁 افزودن دسته‌بندی: ${name}`);
    loadFolders();
  }
}

// آپلود فایل
async function uploadFile() {
  const fileInput = document.getElementById('fileUpload');
  const file = fileInput.files[0];
  if (!file) return alert('فایلی انتخاب نشده.');

  const { data, error: uploadError } = await supabase.storage.from('project-archive-bucket').upload(`${file.name}`, file);

  if (uploadError) {
    console.error(uploadError);
    return;
  }

  const { publicURL } = supabase.storage.from('project-archive-bucket').getPublicUrl(`${file.name}`);

  const { error: insertError } = await supabase.from('documents').insert([{
    name: file.name,
    type: 'file',
    parent_id: currentFolderId,
    file_url: publicURL,
    size: file.size
  }]);

  if (insertError) {
    console.error(insertError);
  } else {
    alert('✅ فایل آپلود شد');
    activities.push(`📄 آپلود فایل: ${file.name}`);
    loadFolders();
  }
}

// حذف آیتم
async function deleteItem(id, type) {
  const confirmPassword = prompt('برای حذف رمز مدیر را وارد کنید:');
  if (confirmPassword !== adminPassword) {
    alert('رمز اشتباه است.');
    return;
  }

  const { error } = await supabase.from('documents').delete().eq('id', id);
  if (error) {
    console.error(error);
  } else {
    alert('✅ آیتم حذف شد');
    activities.push(`🗑 حذف ${type === 'file' ? 'فایل' : 'دسته‌بندی'} با شناسه: ${id}`);
    loadFolders();
  }
}

// دانلود بکاپ اطلاعات
function downloadBackup() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(activities, null, 2));
  const dlAnchor = document.createElement('a');
  dlAnchor.setAttribute("href", dataStr);
  dlAnchor.setAttribute("download", "backup.json");
  dlAnchor.click();
}

document.getElementById('backupButton').onclick = downloadBackup;
document.getElementById('activityLogButton').onclick = showActivityLog;

// نمایش گزارش فعالیت
function showActivityLog() {
  document.getElementById('appContainer').classList.add('hidden');
  document.getElementById('activityLogContainer').classList.remove('hidden');
  const activityList = document.getElementById('activityList');
  activityList.innerHTML = activities.map(act => `<div>${act}</div>`).join('');
}

// بازگشت از گزارش فعالیت به صفحه اصلی
function backToMain() {
  document.getElementById('activityLogContainer').classList.add('hidden');
  document.getElementById('appContainer').classList.remove('hidden');
}
