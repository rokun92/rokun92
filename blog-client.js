document.addEventListener('DOMContentLoaded', () => {
    const isAdminPage = window.location.pathname.includes('admin');
    if (isAdminPage) {
        initAdminApp();
    } else {
        initBlogApp();
    }
});

/* ======================================
   PUBLIC BLOG — read, react, comment
   ====================================== */
function initBlogApp() {
    const blogFeed = document.getElementById('blog-feed');
    const statusElement = document.getElementById('post-form-status');
    const refreshButton = document.getElementById('refresh-posts');
    const countElement = document.getElementById('blog-count');

    if (!blogFeed || !refreshButton || !countElement) return;

    const reactionEmojis = {
        like: '👍',
        love: '❤️',
        insight: '💡',
        clap: '👏'
    };

    const reactionLabels = {
        like: 'Like',
        love: 'Love',
        insight: 'Insight',
        clap: 'Clap'
    };

    const reactionTypes = ['like', 'love', 'insight', 'clap'];

    async function loadPosts() {
        if (statusElement) setStatus('Loading posts...', false);

        try {
            const response = await fetch('/api/posts');
            if (!response.ok) throw new Error('Unable to load posts');

            const posts = await response.json();
            renderPosts(posts);
            countElement.textContent = `${posts.length} post${posts.length === 1 ? '' : 's'}`;
            if (statusElement) setStatus('');
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to load posts';
            blogFeed.innerHTML = `<div class="empty-state-v2"><div class="empty-icon">📭</div>${escapeHtml(message)}</div>`;
            countElement.textContent = '0 posts';
            if (statusElement) setStatus('Unable to load posts right now.', true);
        }
    }

    function setStatus(message, isError = false) {
        if (!statusElement) return;
        statusElement.textContent = message;
        statusElement.style.color = isError ? '#b91c1c' : '#64748b';
    }

    function renderPosts(posts) {
        if (!posts.length) {
            blogFeed.innerHTML = '<div class="empty-state-v2"><div class="empty-icon">✍️</div>No posts yet. Check back soon!</div>';
            return;
        }

        blogFeed.innerHTML = posts.map((post, i) => renderPost(post, i)).join('');
    }

    function renderPost(post, index) {
        const initials = post.author ? post.author.charAt(0).toUpperCase() : '?';
        const commentsHtml = post.comments.length
            ? renderCommentTree(post.comments)
            : '<div class="empty-state-v2" style="padding:18px;font-size:0.88rem;">No comments yet. Start the conversation.</div>';

        return `
            <article class="post-card" data-post-id="${escapeHtml(post.id)}" style="animation-delay:${index * 0.08}s">
                <div class="post-meta">
                    <span class="post-author">
                        <span class="post-author-avatar">${escapeHtml(initials)}</span>
                        ${escapeHtml(post.author)}
                    </span>
                    <span class="post-dot"></span>
                    <span class="post-date">${formatDate(post.createdAt)}</span>
                    <span class="post-dot"></span>
                    <span class="post-comment-count">${post.commentCount} comment${post.commentCount === 1 ? '' : 's'}</span>
                </div>
                <h3 class="post-title">${escapeHtml(post.title)}</h3>
                <p class="post-body">${escapeHtml(post.content)}</p>

                <div class="reactions-bar" aria-label="Reactions">
                    ${reactionTypes.map(r => `
                        <button type="button" class="react-btn" data-reaction="${r}">
                            <span class="react-emoji">${reactionEmojis[r]}</span>
                            <span class="react-count">${post.reactions[r]}</span>
                        </button>
                    `).join('')}
                </div>

                <section class="comments-section-v2">
                    <div class="comments-header">
                        <h4 class="comments-heading">Comments</h4>
                        <span class="comments-count-badge">${post.commentCount}</span>
                    </div>
                    <div class="comment-thread">${commentsHtml}</div>

                    <form class="comment-form-v2" data-comment-form>
                        <div class="comment-input-group">
                            <input type="text" name="name" maxlength="80" placeholder="Your name" value="Guest" required>
                            <textarea name="content" maxlength="1000" placeholder="Write a comment..." rows="2" required></textarea>
                        </div>
                        <button type="submit" class="btn-comment">Comment</button>
                    </form>
                </section>
            </article>
        `;
    }

    /** Recursively render a comment tree */
    function renderCommentTree(comments) {
        return comments.map(comment => {
            const repliesHtml = comment.replies && comment.replies.length
                ? renderCommentTree(comment.replies)
                : '';

            return `
                <div class="comment-node" data-comment-id="${escapeHtml(comment.id)}">
                    <div class="comment-bubble">
                        <div>
                            <span class="comment-author">${escapeHtml(comment.name)}</span>
                            <span class="comment-time">${formatDate(comment.createdAt)}</span>
                        </div>
                        <p class="comment-text">${escapeHtml(comment.content)}</p>
                        <button type="button" class="reply-toggle" data-reply-to="${escapeHtml(comment.id)}">↩ Reply</button>
                    </div>
                    ${repliesHtml}
                </div>
            `;
        }).join('');
    }

    /* --- Event Delegation --- */

    // Reactions
    blogFeed.addEventListener('click', async (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;

        const reactionButton = target.closest('.react-btn');
        if (!reactionButton || !(reactionButton instanceof HTMLButtonElement)) return;

        const postCard = reactionButton.closest('[data-post-id]');
        if (!(postCard instanceof HTMLElement)) return;

        const postId = postCard.dataset.postId;
        const reaction = reactionButton.dataset.reaction;
        if (!postId || !reaction) return;

        reactionButton.disabled = true;
        try {
            await addReaction(postId, reaction);
        } catch (error) {
            setStatus(error instanceof Error ? error.message : 'Failed to add reaction', true);
        } finally {
            reactionButton.disabled = false;
        }
    });

    // Reply toggle — insert inline reply form
    blogFeed.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;

        const replyBtn = target.closest('.reply-toggle');
        if (!replyBtn) return;

        const commentNode = replyBtn.closest('.comment-node');
        if (!commentNode) return;

        // Remove any existing inline reply forms first
        const existingForm = commentNode.querySelector(':scope > .comment-form-v2.reply-form');
        if (existingForm) {
            existingForm.remove();
            return; // toggle off
        }

        // Remove all other open reply forms in this post
        const postCard = replyBtn.closest('[data-post-id]');
        if (postCard) {
            postCard.querySelectorAll('.comment-form-v2.reply-form').forEach(f => f.remove());
        }

        const parentId = replyBtn.dataset.replyTo;
        const form = document.createElement('form');
        form.className = 'comment-form-v2 reply-form';
        form.setAttribute('data-comment-form', '');
        form.setAttribute('data-parent-id', parentId);
        form.innerHTML = `
            <div class="comment-input-group">
                <input type="text" name="name" maxlength="80" placeholder="Your name" value="Guest" required>
                <textarea name="content" maxlength="1000" placeholder="Reply..." rows="2" required></textarea>
            </div>
            <button type="submit" class="btn-comment">Reply</button>
        `;
        commentNode.appendChild(form);
        form.querySelector('textarea').focus();
    });

    // Comment / Reply submit
    blogFeed.addEventListener('submit', async (event) => {
        const target = event.target;
        if (!(target instanceof HTMLFormElement) || !target.matches('form[data-comment-form]')) return;

        event.preventDefault();

        const postCard = target.closest('[data-post-id]');
        if (!(postCard instanceof HTMLElement)) return;

        const postId = postCard.dataset.postId;
        if (!postId) return;

        const parentId = target.dataset.parentId || null;

        const submitButton = target.querySelector('button[type="submit"]');
        if (submitButton instanceof HTMLButtonElement) submitButton.disabled = true;

        try {
            await addComment(postId, target, parentId);
            setStatus('Comment added successfully.');
        } catch (error) {
            setStatus(error instanceof Error ? error.message : 'Failed to add comment', true);
        } finally {
            if (submitButton instanceof HTMLButtonElement) submitButton.disabled = false;
        }
    });

    async function addReaction(postId, reaction) {
        const response = await fetch(`/api/posts/${postId}/reactions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reaction })
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error ?? 'Failed to add reaction');

        await loadPosts();
    }

    async function addComment(postId, form, parentId) {
        const formData = new FormData(form);
        const payload = Object.fromEntries(formData.entries());
        if (parentId) payload.parentId = parentId;

        const response = await fetch(`/api/posts/${postId}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error ?? 'Failed to add comment');

        form.reset();
        const nameInput = form.querySelector('input[name="name"]');
        if (nameInput instanceof HTMLInputElement) nameInput.value = 'Guest';

        await loadPosts();
    }

    refreshButton.addEventListener('click', () => loadPosts());

    loadPosts();

    function formatDate(isoString) {
        return new Date(isoString).toLocaleString([], {
            dateStyle: 'medium',
            timeStyle: 'short'
        });
    }

    function escapeHtml(value) {
        return String(value)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }
}

/* ======================================
   ADMIN PAGE — password-protected post creation
   ====================================== */
function initAdminApp() {
    const loginSection = document.getElementById('admin-login');
    const dashboardSection = document.getElementById('admin-dashboard');
    const loginForm = document.getElementById('admin-login-form');
    const loginError = document.getElementById('login-error');
    const postForm = document.getElementById('admin-post-form');
    const postStatus = document.getElementById('admin-post-status');
    const logoutBtn = document.getElementById('admin-logout');

    if (!loginSection || !dashboardSection || !loginForm || !postForm) return;

    let adminToken = sessionStorage.getItem('admin_token') || '';

    // If already logged in, verify token
    if (adminToken) {
        verifyToken(adminToken).then(ok => {
            if (ok) showDashboard();
            else { adminToken = ''; sessionStorage.removeItem('admin_token'); }
        });
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = loginForm.querySelector('input[name="password"]').value;
        loginError.textContent = '';

        const ok = await verifyToken(password);
        if (ok) {
            adminToken = password;
            sessionStorage.setItem('admin_token', password);
            showDashboard();
        } else {
            loginError.textContent = 'Invalid password. Access denied.';
        }
    });

    postForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(postForm);
        const payload = Object.fromEntries(formData.entries());

        postStatus.textContent = 'Publishing...';
        postStatus.style.color = '#94a3b8';

        try {
            const res = await fetch('/api/posts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${adminToken}`
                },
                body: JSON.stringify(payload)
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Failed to publish');

            postForm.reset();
            postForm.querySelector('input[name="author"]').value = 'Rokunujjaman';
            postStatus.textContent = '✅ Post published successfully!';
            postStatus.style.color = '#22c55e';
        } catch (error) {
            postStatus.textContent = `❌ ${error.message}`;
            postStatus.style.color = '#ef4444';
        }
    });

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            adminToken = '';
            sessionStorage.removeItem('admin_token');
            loginSection.classList.remove('hidden');
            dashboardSection.classList.add('hidden');
        });
    }

    async function verifyToken(token) {
        try {
            const res = await fetch('/api/admin/verify', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return res.ok;
        } catch {
            return false;
        }
    }

    function showDashboard() {
        loginSection.classList.add('hidden');
        dashboardSection.classList.remove('hidden');
    }
}