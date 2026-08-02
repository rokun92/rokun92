import app from '../server.js';

export default function handler(req: Request, res: Response) {
  return app(req, res);
}

export const config = {
  runtime: 'nodejs',
};
