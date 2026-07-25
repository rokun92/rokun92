document.addEventListener('DOMContentLoaded', () => {
    initBlogApp();
});

function initBlogApp() {
    const blogFeed = document.getElementById('blog-feed');
    const postForm = document.getElementById('post-form');
    const statusElement = document.getElementById('post-form-status');
    const refreshButton = document.getElementById('refresh-posts');
    const countElement = document.getElementById('blog-count');

    if (!blogFeed || !postForm || !statusElement || !refreshButton || !countElement) {
        return;
    }

    const reactionLabels = {
        like: 'Like',
        love: 'Love',
        insight: 'Insight',
        clap: 'Clap'
    };

    const reactionTypes = ['like', 'love', 'insight', 'clap'];

    async function loadPosts() {
        setStatus('Loading posts...', false);

        try {
            const response = await fetch('/api/posts');
            if (!response.ok) {
                throw new Error('Unable to load posts');
            }

            const posts = await response.json();
            renderPosts(posts);
            countElement.textContent = `${posts.length} post${posts.length === 1 ? '' : 's'}`;
            setStatus('');
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to load posts';
            blogFeed.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
            countElement.textContent = '0 posts';
            setStatus('Unable to load posts right now.', true);
        }
    }

    function setStatus(message, isError = false) {
        statusElement.textContent = message;
        statusElement.style.color = isError ? '#b91c1c' : '#64748b';
    }

    function renderPosts(posts) {
        if (!posts.length) {
            blogFeed.innerHTML = '<div class="empty-state">No posts yet. Publish the first one.</div>';
            return;
        }

        blogFeed.innerHTML = posts.map(renderPost).join('');
    }

    function renderPost(post) {
        const commentsHtml = post.comments.length
            ? post.comments.map(renderComment).join('')
            : '<div class="empty-state">No comments yet. Start the conversation.</div>';

        return `
            <article class="blog-post-card" data-post-id="${escapeHtml(post.id)}">
                <div class="blog-post-meta">
                    <span>By ${escapeHtml(post.author)}</span>
                    <span>${escapeHtml(formatDate(post.createdAt))}</span>
                    <span>${post.comments.length} comment${post.comments.length === 1 ? '' : 's'}</span>
                </div>
                <h3 class="blog-post-title">${escapeHtml(post.title)}</h3>
                <p class="blog-post-content">${escapeHtml(post.content)}</p>
                <div class="reaction-row" aria-label="Reactions">
                    ${reactionTypes.map((reaction) => `
                        <button type="button" class="reaction-button" data-reaction="${reaction}">
                            ${reactionLabels[reaction]}
                            <span class="reaction-count">${post.reactions[reaction]}</span>
                        </button>
                    `).join('')}
                </div>
                <section class="comments-section">
                    <h4 class="comments-title">Comments</h4>
                    <div class="comment-list">${commentsHtml}</div>
                    <form class="comment-form" data-comment-form>
                        <label>
                            <span class="sr-only">Name</span>
                            <input type="text" name="name" maxlength="80" placeholder="Your name" value="Guest" required>
                        </label>
                        <label>
                            <span class="sr-only">Comment</span>
                            <textarea name="content" maxlength="1000" placeholder="Write a comment..." required></textarea>
                        </label>
                        <div class="comment-form-footer">
                            <button type="submit" class="comment-submit">Add comment</button>
                        </div>
                    </form>
                </section>
            </article>
        `;
    }

    function renderComment(comment) {
        return `
            <div class="comment-item">
                <div class="comment-meta">
                    <strong>${escapeHtml(comment.name)}</strong>
                    <span>${escapeHtml(formatDate(comment.createdAt))}</span>
                </div>
                <p class="comment-body">${escapeHtml(comment.content)}</p>
            </div>
        `;
    }

    async function createPost(form) {
        const formData = new FormData(form);
        const payload = Object.fromEntries(formData.entries());

        const response = await fetch('/api/posts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(data.error ?? 'Failed to create post');
        }

        form.reset();
        const authorInput = form.querySelector('input[name="author"]');
        if (authorInput instanceof HTMLInputElement) {
            authorInput.value = 'Rokunujjaman';
        }

        await loadPosts();
        setStatus('Post published successfully.');
    }

    async function addReaction(postId, reaction) {
        const response = await fetch(`/api/posts/${postId}/reactions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reaction })
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data.error ?? 'Failed to add reaction');
        }

        await loadPosts();
    }

    async function addComment(postId, form) {
        const formData = new FormData(form);
        const payload = Object.fromEntries(formData.entries());

        const response = await fetch(`/api/posts/${postId}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data.error ?? 'Failed to add comment');
        }

        form.reset();
        const nameInput = form.querySelector('input[name="name"]');
        if (nameInput instanceof HTMLInputElement) {
            nameInput.value = 'Guest';
        }

        await loadPosts();
    }

    blogFeed.addEventListener('click', async (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
            return;
        }

        const reactionButton = target.closest('button[data-reaction]');
        if (!reactionButton || !(reactionButton instanceof HTMLButtonElement)) {
            return;
        }

        const postCard = reactionButton.closest('[data-post-id]');
        if (!(postCard instanceof HTMLElement)) {
            return;
        }

        const postId = postCard.dataset.postId;
        const reaction = reactionButton.dataset.reaction;
        if (!postId || !reaction) {
            return;
        }

        reactionButton.disabled = true;
        try {
            await addReaction(postId, reaction);
        } catch (error) {
            setStatus(error instanceof Error ? error.message : 'Failed to add reaction', true);
        } finally {
            reactionButton.disabled = false;
        }
    });

    blogFeed.addEventListener('submit', async (event) => {
        const target = event.target;
        if (!(target instanceof HTMLFormElement) || !target.matches('form[data-comment-form]')) {
            return;
        }

        event.preventDefault();

        const postCard = target.closest('[data-post-id]');
        if (!(postCard instanceof HTMLElement)) {
            return;
        }

        const postId = postCard.dataset.postId;
        if (!postId) {
            return;
        }

        const submitButton = target.querySelector('button[type="submit"]');
        if (submitButton instanceof HTMLButtonElement) {
            submitButton.disabled = true;
        }

        try {
            await addComment(postId, target);
            setStatus('Comment added successfully.');
        } catch (error) {
            setStatus(error instanceof Error ? error.message : 'Failed to add comment', true);
        } finally {
            if (submitButton instanceof HTMLButtonElement) {
                submitButton.disabled = false;
            }
        }
    });

    postForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const submitButton = postForm.querySelector('button[type="submit"]');
        if (submitButton instanceof HTMLButtonElement) {
            submitButton.disabled = true;
        }

        try {
            await createPost(postForm);
        } catch (error) {
            setStatus(error instanceof Error ? error.message : 'Failed to create post', true);
        } finally {
            if (submitButton instanceof HTMLButtonElement) {
                submitButton.disabled = false;
            }
        }
    });

    refreshButton.addEventListener('click', () => {
        loadPosts();
    });

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