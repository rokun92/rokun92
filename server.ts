import express from 'express';
import { MongoClient, ObjectId, type Collection } from 'mongodb';
import dotenv from "dotenv";

dotenv.config();

type ReactionType = 'like' | 'love' | 'insight' | 'clap';

type CommentDoc = {
    _id: ObjectId;
    name: string;
    content: string;
    parentId: string | null;
    createdAt: Date;
};

type PostDoc = {
    _id: ObjectId;
    title: string;
    content: string;
    author: string;
    createdAt: Date;
    updatedAt: Date;
    reactions: Record<ReactionType, number>;
    comments: CommentDoc[];
};

type CommentView = {
    id: string;
    name: string;
    content: string;
    parentId: string | null;
    createdAt: string;
    replies: CommentView[];
};

type PostView = {
    id: string;
    title: string;
    content: string;
    author: string;
    createdAt: string;
    updatedAt: string;
    reactions: Record<ReactionType, number>;
    comments: CommentView[];
    commentCount: number;
};

const app = express();
const port = Number(process.env.PORT ?? 3000);
const mongoUri = process.env.MONGODB_URI ?? "";
const databaseName = process.env.MONGODB_DB ?? 'psite';
const collectionName = 'posts';
const reactionTypes: ReactionType[] = ['like', 'love', 'insight', 'clap'];
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? '';

// Parse MongoDB URI and ensure SSL options are set for Atlas connections
function getMongoUri(): string {
    if (!mongoUri) {
        return "";
    }
    
    // For Atlas connections, we need specific SSL settings
    if (mongoUri.includes('mongodb.net')) {
        // Parse existing query parameters
        const [baseUri, existingQuery] = mongoUri.split('?');
        const params = new URLSearchParams(existingQuery || '');
        
        // Set required parameters (will override if already present)
        if (!params.has('tls') && !params.has('ssl')) {
            params.set('tls', 'true');
        }
        if (!params.has('retryWrites')) {
            params.set('retryWrites', 'true');
        }
        if (!params.has('w')) {
            params.set('w', 'majority');
        }
        
        return `${baseUri}?${params.toString()}`;
    }
    
    return mongoUri;
}

const client = new MongoClient(getMongoUri());
let clientPromise: Promise<MongoClient> | null = null;

app.use(express.json());
app.use(express.static(process.cwd()));

function sendError(res: express.Response, statusCode: number, message: string) {
    return res.status(statusCode).json({ error: message });
}

function ensureText(value: unknown, fieldName: string, maxLength: number) {
    if (typeof value !== 'string') {
        throw new Error(`${fieldName} is required`);
    }

    const trimmed = value.trim();
    if (!trimmed) {
        throw new Error(`${fieldName} is required`);
    }

    if (trimmed.length > maxLength) {
        throw new Error(`${fieldName} must be ${maxLength} characters or fewer`);
    }

    return trimmed;
}

/** Build a nested comment tree from the flat comments array */
function buildCommentTree(comments: CommentDoc[]): CommentView[] {
    const map = new Map<string, CommentView>();
    const roots: CommentView[] = [];

    // First pass: create view objects
    for (const c of comments) {
        const view: CommentView = {
            id: c._id.toHexString(),
            name: c.name,
            content: c.content,
            parentId: c.parentId,
            createdAt: c.createdAt.toISOString(),
            replies: []
        };
        map.set(view.id, view);
    }

    // Second pass: link children to parents
    for (const view of map.values()) {
        if (view.parentId && map.has(view.parentId)) {
            map.get(view.parentId)!.replies.push(view);
        } else {
            roots.push(view);
        }
    }

    return roots;
}

function toPostView(post: PostDoc): PostView {
    return {
        id: post._id.toHexString(),
        title: post.title,
        content: post.content,
        author: post.author,
        createdAt: post.createdAt.toISOString(),
        updatedAt: post.updatedAt.toISOString(),
        reactions: post.reactions,
        comments: buildCommentTree(post.comments),
        commentCount: post.comments.length
    };
}

async function getClient() {
    if (!clientPromise) {
        clientPromise = client.connect();
    }

    return clientPromise;
}

async function getCollection(): Promise<Collection<PostDoc>> {
    const mongoClient = await getClient();
    return mongoClient.db(databaseName).collection<PostDoc>(collectionName);
}

async function seedCollectionIfEmpty(collection: Collection<PostDoc>) {
    const count = await collection.countDocuments();
    if (count > 0) {
        return;
    }

    const now = new Date();
    await collection.insertMany([
        {
            _id: new ObjectId(),
            title: 'Understanding Unsupervised Clustering for Environmental & Heat Stress Data',
            content: 'An overview of applying unsupervised learning algorithms to uncover spatial patterns in climate data and heat-stroke risks.',
            author: 'Rokunujjaman',
            createdAt: now,
            updatedAt: now,
            reactions: { like: 0, love: 0, insight: 0, clap: 0 },
            comments: []
        },
        {
            _id: new ObjectId(),
            title: 'Lessons Learned from 500+ Competitive Programming Problems',
            content: 'Key insights on problem solving, dynamic programming optimizations, and graph traversal strategies.',
            author: 'Rokunujjaman',
            createdAt: now,
            updatedAt: now,
            reactions: { like: 0, love: 0, insight: 0, clap: 0 },
            comments: []
        }
    ]);
}

function assertValidPostId(postId: string) {
    if (!ObjectId.isValid(postId)) {
        throw new Error('Post not found');
    }

    return new ObjectId(postId);
}

/** Middleware: check admin password from Authorization header */
function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
    const authHeader = req.headers.authorization ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

    if (!ADMIN_PASSWORD || token !== ADMIN_PASSWORD) {
        sendError(res, 401, 'Unauthorized');
        return;
    }

    next();
}

app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
});

app.get('/api/posts', async (_req, res) => {
    try {
        const collection = await getCollection();
        const posts = await collection.find().sort({ createdAt: -1 }).toArray();
        res.json(posts.map(toPostView));
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load posts';
        sendError(res, 500, message);
    }
});

/** Admin-only: verify password */
app.post('/api/admin/verify', requireAdmin, (_req, res) => {
    res.json({ ok: true });
});

/** Admin-only: create post */
app.post('/api/posts', requireAdmin, async (req, res) => {
    try {
        const title = ensureText(req.body?.title, 'Title', 120);
        const content = ensureText(req.body?.content, 'Content', 4000);
        const author = ensureText(req.body?.author ?? 'Guest', 'Author', 80);
        const now = new Date();

        const collection = await getCollection();
        const createdPost: PostDoc = {
            _id: new ObjectId(),
            title,
            content,
            author,
            createdAt: now,
            updatedAt: now,
            reactions: { like: 0, love: 0, insight: 0, clap: 0 },
            comments: []
        };

        await collection.insertOne(createdPost);
        res.status(201).json(toPostView(createdPost));
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create post';
        sendError(res, 400, message);
    }
});

app.post('/api/posts/:id/reactions', async (req, res) => {
    try {
        const reaction = ensureText(req.body?.reaction, 'Reaction', 20) as ReactionType;
        if (!reactionTypes.includes(reaction)) {
            throw new Error('Unsupported reaction');
        }

        const collection = await getCollection();
        const postId = assertValidPostId(req.params.id);

        const updatedPost = await collection.findOneAndUpdate(
            { _id: postId },
            {
                $inc: { [`reactions.${reaction}`]: 1 },
                $set: { updatedAt: new Date() }
            },
            { returnDocument: 'after' }
        );

        if (!updatedPost) {
            throw new Error('Post not found');
        }

        res.json(toPostView(updatedPost));
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to add reaction';
        const statusCode = message === 'Post not found' ? 404 : 400;
        sendError(res, statusCode, message);
    }
});

/** Add comment (supports parentId for nested replies) */
app.post('/api/posts/:id/comments', async (req, res) => {
    try {
        const name = ensureText(req.body?.name ?? 'Guest', 'Name', 80);
        const content = ensureText(req.body?.content, 'Comment', 1000);
        const parentId = typeof req.body?.parentId === 'string' && req.body.parentId.trim()
            ? req.body.parentId.trim()
            : null;

        const collection = await getCollection();
        const postId = assertValidPostId(req.params.id);

        const newComment: CommentDoc = {
            _id: new ObjectId(),
            name,
            content,
            parentId,
            createdAt: new Date()
        };

        const updatedPost = await collection.findOneAndUpdate(
            { _id: postId },
            {
                $push: { comments: newComment },
                $set: { updatedAt: new Date() }
            },
            { returnDocument: 'after' }
        );

        if (!updatedPost) {
            throw new Error('Post not found');
        }

        res.json(toPostView(updatedPost));
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to add comment';
        const statusCode = message === 'Post not found' ? 404 : 400;
        sendError(res, statusCode, message);
    }
});

async function bootstrap() {
    const collection = await getCollection();
    await collection.createIndex({ createdAt: -1 });
    await seedCollectionIfEmpty(collection);
}

let initialized = false;
let initPromise: Promise<void> | null = null;

app.use(async (req, res, next) => {
    try {
        if (!initialized) {
            if (!initPromise) {
                initPromise = bootstrap();
            }

            await initPromise;
            initialized = true;
        }

        next();
    } catch (error) {
        console.error("Bootstrap failed:", error);
        res.status(500).json({
            error: "Database initialization failed",
            message: error instanceof Error ? error.message : String(error)
        });
    }
});

if (!process.env.VERCEL) {
    app.listen(port, () => {
        console.log(`Blog server running on http://localhost:${port}`);
    });
}

export default app; 
