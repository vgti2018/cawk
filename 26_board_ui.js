// cawk
import { dbService } from './database-service.js'

let posts = JSON.parse(localStorage.getItem('posts_cache') || '[]');
let tagProfile = {};  
let ipAddress = 'device';

const feed          = document.getElementById('feed-wrap');
const searchInput   = document.getElementById('searchInput');
const reportConfirm = document.getElementById('reportConfirmModal');
const deleteConfirm = document.getElementById('deleteConfirmModal');
const lightbox      = document.getElementById('lightbox');
const themeSwitch   = document.getElementById('themeSwitch');
const newPostModal  = document.getElementById('newPostModal');

let selectedBoard   = 'general';
let recommendedView = false;
let searchTerm      = '';
let pendingReport   = null;
let pendingDelete   = null;

// Initialize database service
async function initializeDatabase() {
  try {
    await dbService.init()
    // Update posts from database
    posts = dbService.getAllPosts()
    console.log('Database initialized, loaded', posts.length, 'posts')
  } catch (error) {
    console.error('Failed to initialize database:', error)
    // Fallback to localStorage if database fails
    console.log('Falling back to localStorage')
  }
}

function savePosts() {
  localStorage.setItem('posts_cache', JSON.stringify(posts));
}
function saveProfiles() {
  localStorage.setItem('tag_profile_device', JSON.stringify(tagProfile));
  const ipk = `tag_profile_ip_${ipAddress}`;
  localStorage.setItem(ipk, JSON.stringify(tagProfile));
}


async function initProfile() {
  // fetch IP for per-IP storage
  try {
    const res = await fetch('https://api.ipify.org?format=json');
    const data = await res.json();
    ipAddress = data.ip;
  } catch {
    console.warn(':< could not fetch IP, using device-only profile');
  }

  const dev = JSON.parse(localStorage.getItem('tag_profile_device') || '{}');
  const ipk = `tag_profile_ip_${ipAddress}`;
  const ip  = JSON.parse(localStorage.getItem(ipk) || '{}');
  tagProfile = { ...dev };
  for (let t in ip) {
    tagProfile[t] = (tagProfile[t] || 0) + ip[t];
  }
}


function extractTags(text) {
  return [...new Set(
    (text.toLowerCase().match(/\b\w+\b/g) || [])
  )];
}
function adjustTags(tags, delta) {
  tags.forEach(tag => {
    tagProfile[tag] = (tagProfile[tag] || 0) + delta;
    if (tagProfile[tag] === 0) delete tagProfile[tag];
  });
  saveProfiles();
}


function stripImageMetadata(dataURL, cb) {
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width  = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    cb(canvas.toDataURL('image/jpeg'));
  };
  img.src = dataURL;
}

function updateThemeText() {
  themeSwitch.textContent =
    document.body.dataset.theme === 'light' ? 'Light Mode' : 'Dark Mode';
}
themeSwitch.onclick = () => {
  document.body.dataset.theme =
    document.body.dataset.theme === 'light' ? 'dark' : 'light';
  updateThemeText();
};
updateThemeText();


document.querySelectorAll('.pill[data-tab]').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.pill[data-tab]')
      .forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if (btn.dataset.tab === 'about') {
      document.getElementById('tab-contents').innerHTML =
        '<p>no rules other than no NSFW content</p>';
    } else {
      const hideRep = localStorage.getItem('hideReported') === 'true';
      document.getElementById('tab-contents').innerHTML = `
        <label>
          <input type="checkbox" id="hideReportedCheckbox"
            ${hideRep ? 'checked' : ''}> Hide reported
        </label>`;
      document.getElementById('hideReportedCheckbox').onchange = e => {
        localStorage.setItem('hideReported', e.target.checked);
        render();
      };
    }
  };
});


document.querySelectorAll('#board-chips .chip').forEach(chip => {
  chip.onclick = () => {
    selectedBoard = chip.dataset.board;
    recommendedView = false;
    document.querySelectorAll('#board-chips .chip')
      .forEach(x => x.classList.toggle(
        'checked', x.dataset.board === selectedBoard
      ));
    updateCategorySelection();
    render();
  };
});

document.querySelectorAll('#category-bar .category-item').forEach(item => {
  item.onclick = () => {
    selectedBoard = item.dataset.board;
    recommendedView = false;
    updateCategorySelection();
    document.querySelectorAll('#board-chips .chip')
      .forEach(x => x.classList.toggle(
        'checked', x.dataset.board === selectedBoard
      ));
    render();
  };
});

function updateCategorySelection() {
  document.querySelectorAll('#category-bar .category-item')
    .forEach(x => x.classList.toggle(
      'selected', x.dataset.board === selectedBoard
    ));
}


document.getElementById('homeBtn').onclick = () => {
  recommendedView = false;
  document.getElementById('category-bar').style.display = 'flex';
  document.getElementById('feed-wrap').style.display = 'block';
  render();
};

document.getElementById('feedBtn').onclick = () => {
  recommendedView = true;
  document.getElementById('category-bar').style.display = 'none';
  render();
};

searchInput.oninput = e => {
  searchTerm = e.target.value.toLowerCase();
  render();
};


document.getElementById('newPostBtn').onclick = () => {
  newPostModal.style.display = 'flex';
};
const imgInput = document.getElementById('newPostImage');
const imgName  = document.getElementById('newPostImageName');
imgInput.onchange = () => {
  imgName.textContent = imgInput.files.length
    ? imgInput.files[0].name
    : 'No file chosen';
};
document.getElementById('submitPost').onclick = async () => {
  const txt   = document.getElementById('newPostContent').value.trim();
  if (!txt) return;
  const board = document.getElementById('newPostBoard').value;
  const tags  = extractTags(txt);

  const addPost = async (image) => {
    try {
      const postData = {
        board,
        content: txt,
        image: image || null,
        tags,
        userIp: ipAddress
      };

      const newPost = await dbService.addPost(postData);
      
      if (newPost) {
        // Update local posts array
        posts.unshift(newPost);
        savePosts();
        
        // Track own posts
        let own = JSON.parse(localStorage.getItem('own_posts') || '[]');
        own.push(newPost.id);
        localStorage.setItem('own_posts', JSON.stringify(own));
        
        // Clear form
        document.getElementById('newPostContent').value = '';
        document.getElementById('newPostImage').value = '';
        document.getElementById('newPostImageName').textContent = 'No file chosen';
        
        newPostModal.style.display = 'none';
        render();
      } else {
        console.error('Failed to add post to database');
        // Fallback to localStorage
        const id = Date.now();
        posts.unshift({
          id,
          board,
          content: txt,
          image: image || null,
          votes: 0,
          reports: 0,
          createdAt: Date.now(),
          tags
        });
        savePosts();
        let own = JSON.parse(localStorage.getItem('own_posts') || '[]');
        own.push(id);
        localStorage.setItem('own_posts', JSON.stringify(own));
        newPostModal.style.display = 'none';
        render();
      }
    } catch (error) {
      console.error('Error adding post:', error);
      // Fallback to localStorage
      const id = Date.now();
      posts.unshift({
        id,
        board,
        content: txt,
        image: image || null,
        votes: 0,
        reports: 0,
        createdAt: Date.now(),
        tags
      });
      savePosts();
      let own = JSON.parse(localStorage.getItem('own_posts') || '[]');
      own.push(id);
      localStorage.setItem('own_posts', JSON.stringify(own));
      newPostModal.style.display = 'none';
      render();
    }
  };

  if (imgInput.files.length) {
    const reader = new FileReader();
    reader.onload = () => stripImageMetadata(
      reader.result, clean => addPost(clean)
    );
    reader.readAsDataURL(imgInput.files[0]);
  } else {
    await addPost(null);
  }
};
newPostModal.onclick = e => {
  if (e.target === newPostModal) newPostModal.style.display = 'none';
};

// peenus
async function vote(post, dir, cntEl, upEl, dnEl) {
  const key = `vote_p_${post.id}`;
  const prev = localStorage.getItem(key);
  
  try {
    if (prev === dir) {
      adjustTags(post.tags, dir === 'up' ? -1 : +1);
      post.votes += dir === 'up' ? -1 : +1;
      localStorage.removeItem(key);
    } else {
      if (prev === 'up')  { adjustTags(post.tags, -1); post.votes--; }
      if (prev === 'down'){ adjustTags(post.tags, +1); post.votes++; }
      adjustTags(post.tags, dir === 'up' ? +1 : -1);
      post.votes += dir === 'up' ? +1 : -1;
      localStorage.setItem(key, dir);
    }
    
    // Update in database
    const updatedPost = await dbService.updatePost(post.id, { votes: post.votes });
    if (updatedPost) {
      // Update local post with database data
      Object.assign(post, updatedPost);
    }
    
    cntEl.textContent = post.votes;
    upEl.style.opacity   = localStorage.getItem(key) === 'up'   ? '1' : '0.5';
    dnEl.style.opacity   = localStorage.getItem(key) === 'down' ? '1' : '0.5';
    savePosts();
  } catch (error) {
    console.error('Error voting on post:', error);
    // Fallback to localStorage only
    savePosts();
  }
}


async function confirmReport() {
  try {
    pendingReport.reports++;
    
    // Update in database
    const updatedPost = await dbService.updatePost(pendingReport.id, { reports: pendingReport.reports });
    if (updatedPost) {
      // Update local post with database data
      Object.assign(pendingReport, updatedPost);
    }
    
    savePosts();
    adjustTags(pendingReport.tags, -pendingReport.votes);
    localStorage.setItem(`reported_p_${pendingReport.id}`, '1');
  } catch (error) {
    console.error('Error reporting post:', error);
    // Fallback to localStorage only
    savePosts();
  }
}


function calculateScore(post) {
  let tagScore = 0;
  post.tags.forEach(t => {
    tagScore += tagProfile[t] || 0;
  });
  const ageHrs = (Date.now() - post.createdAt) / 3600000;
  return tagScore / Math.pow(ageHrs + 2, 1.5);
}

function render() {
  feed.innerHTML = '';
  const hideRep = localStorage.getItem('hideReported') === 'true';
  let list = posts.filter(p => {
    if (hideRep && localStorage.getItem(`reported_p_${p.id}`)) return false;
    if (!recommendedView) {
      return p.board === selectedBoard &&
             p.content.toLowerCase().includes(searchTerm);
    }
    return true;
  });

  if (recommendedView) {
    list.sort((a, b) => calculateScore(b) - calculateScore(a));
  } else {
    list.sort((a, b) => b.createdAt - a.createdAt);
  }

  const own = JSON.parse(localStorage.getItem('own_posts') || '[]');

  list.forEach(p => {
    const div = document.createElement('div');
    div.className = 'post';
    if (localStorage.getItem('selectedPost') == p.id) {
      div.classList.add('selected');
    }
    div.onclick = () => {
      document.querySelectorAll('.post')
        .forEach(x => x.classList.remove('selected'));
      div.classList.add('selected');
      localStorage.setItem('selectedPost', p.id);
    };

    const para = document.createElement('p');
    para.textContent = p.content;
    div.appendChild(para);

    if (p.image) {
      const img = document.createElement('img');
      img.src = p.image;
      img.onclick = e => {
        e.stopPropagation();
        showLightbox(p.image);
      };
      div.appendChild(img);
    }

    const foot = document.createElement('div');
    foot.className = 'post-footer';


    const flag = document.createElement('div');
    flag.className = 'flag';
    if (localStorage.getItem(`reported_p_${p.id}`)) {
      flag.style.opacity = '0.5';
      flag.style.pointerEvents = 'none';
    }
    flag.onclick = e => {
      e.stopPropagation();
      if (!localStorage.getItem(`reported_p_${p.id}`)) {
        pendingReport = p;
        reportConfirm.style.display = 'flex';
      }
    };

    // delete
    const del = document.createElement('div');
    del.className = 'delete-btn';
    if (own.includes(p.id)) {
      del.onclick = e => {
        e.stopPropagation();
        pendingDelete = p;
        deleteConfirm.style.display = 'flex';
      };
    }

    // vote controls
    const vc = document.createElement('div');
    vc.className = 'vote-controls';
    const up = document.createElement('div'),
          dn = document.createElement('div'),
          cnt = document.createElement('span');
    up.className = 'upvote';
    dn.className = 'downvote';
    cnt.className = 'vote-count';
    cnt.textContent = p.votes;
    if (localStorage.getItem(`vote_p_${p.id}`) === 'up')   up.style.opacity = '1';
    if (localStorage.getItem(`vote_p_${p.id}`) === 'down') dn.style.opacity = '1';
    up.onclick = e => { e.stopPropagation(); vote(p, 'up', cnt, up, dn); };
    dn.onclick = e => { e.stopPropagation(); vote(p, 'down', cnt, up, dn); };
    vc.append(up, cnt, dn);

    foot.append(flag, del, vc);
    div.appendChild(foot);
    feed.appendChild(div);
  });
}


document.getElementById('confirmReportYes').onclick = () => {
  reportConfirm.style.display = 'none';
  confirmReport();
  pendingReport = null;
  render();
};
document.getElementById('confirmReportNo').onclick = () => {
  reportConfirm.style.display = 'none';
  pendingReport = null;
};

document.getElementById('confirmDeleteYes').onclick = async () => {
  try {
    // Delete from database
    const success = await dbService.deletePost(pendingDelete.id);
    
    if (success) {
      // Remove from local array
      posts = posts.filter(x => x.id !== pendingDelete.id);
      savePosts();
      let own = JSON.parse(localStorage.getItem('own_posts') || '[]');
      own = own.filter(x => x !== pendingDelete.id);
      localStorage.setItem('own_posts', JSON.stringify(own));
    } else {
      console.error('Failed to delete post from database');
      // Fallback to localStorage only
      posts = posts.filter(x => x.id !== pendingDelete.id);
      savePosts();
      let own = JSON.parse(localStorage.getItem('own_posts') || '[]');
      own = own.filter(x => x !== pendingDelete.id);
      localStorage.setItem('own_posts', JSON.stringify(own));
    }
    
    deleteConfirm.style.display = 'none';
    pendingDelete = null;
    render();
  } catch (error) {
    console.error('Error deleting post:', error);
    // Fallback to localStorage only
    posts = posts.filter(x => x.id !== pendingDelete.id);
    savePosts();
    let own = JSON.parse(localStorage.getItem('own_posts') || '[]');
    own = own.filter(x => x !== pendingDelete.id);
    localStorage.setItem('own_posts', JSON.stringify(own));
    deleteConfirm.style.display = 'none';
    pendingDelete = null;
    render();
  }
};
document.getElementById('confirmDeleteNo').onclick = () => {
  deleteConfirm.style.display = 'none';
  pendingDelete = null;
};

function showLightbox(src) {
  lightbox.innerHTML =
    `<img src="${src}"><button id="closeLightbox">×</button>`;
  lightbox.style.display = 'flex';
  document.getElementById('closeLightbox').onclick = () => {
    lightbox.style.display = 'none';
  };
}


// Initialize everything
async function init() {
  await initProfile();
  await initializeDatabase();
  render();
}

init();
