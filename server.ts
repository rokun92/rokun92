import express from 'express';
import { MongoClient, ObjectId, type Collection } from 'mongodb';
import dotenv from "dotenv";

dotenv.config();

type ReactionType = 'like' | 'love' | 'insight' | 'clap';

type CommentDoc = {
    _id: ObjectId;
    name: string;
    content: string;
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

type PostView = {
    id: string;
    title: string;
    content: string;
    author: string;
    createdAt: string;
    updatedAt: string;
    reactions: Record<ReactionType, number>;
    comments: Array<{
        id: string;
        name: string;
        content: string;
        createdAt: string;
    }>;
};

const app = express();
const port = Number(process.env.PORT ?? 3000);
const mongoUri = process.env.MONGODB_URI ?? "";
const databaseName = process.env.MONGODB_DB ?? 'psite';
const collectionName = 'posts';
const reactionTypes: ReactionType[] = ['like', 'love', 'insight', 'clap'];

const client = new MongoClient(mongoUri);
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

function toPostView(post: PostDoc): PostView {
    return {
        id: post._id.toHexString(),
        title: post.title,
        content: post.content,
        author: post.author,
        createdAt: post.createdAt.toISOString(),
        updatedAt: post.updatedAt.toISOString(),
        reactions: post.reactions,
        comments: post.comments.map((comment) => ({
            id: comment._id.toHexString(),
            name: comment.name,
            content: comment.content,
            createdAt: comment.createdAt.toISOString()
        }))
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

app.post('/api/posts', async (req, res) => {
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

app.post('/api/posts/:id/comments', async (req, res) => {
    try {
        const name = ensureText(req.body?.name ?? 'Guest', 'Name', 80);
        const content = ensureText(req.body?.content, 'Comment', 1000);

        const collection = await getCollection();
        const postId = assertValidPostId(req.params.id);

        const newComment: CommentDoc = {
            _id: new ObjectId(),
            name,
            content,
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

    app.listen(port, () => {
        console.log(`Blog server running on http://localhost:${port}`);
    });
}

bootstrap().catch((error) => {
    console.error('Failed to start blog server', error);
    process.exitCode = 1;
});