import type { Context, Config } from '@netlify/functions';
import { guard } from '../../src/lib/auth.mts';
import { jsonResponse, corsPreflightResponse } from '../../src/lib/govApi.mts';

export default async (req: Request, _context: Context) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse();
  const denied = await guard(req, 'edit');
  if (denied) return denied;

  const check = (name: string) => {
    const v = Netlify.env.get(name);
    return { present: Boolean(v), length: v ? v.length : 0 };
  };

  return jsonResponse({
    TOUR_API_KEY: check('TOUR_API_KEY'),
    DURUNUBI_API_KEY: check('DURUNUBI_API_KEY'),
    FESTIVAL_API_KEY: check('FESTIVAL_API_KEY'),
    DEBUG_TEST_VAR: check('DEBUG_TEST_VAR'),
    NAVER_SEARCH_ID: check('NAVER_SEARCH_ID'),
    NAVER_SEARCH_SECRET: check('NAVER_SEARCH_SECRET'),
  });
};

export const config: Config = {
  path: '/api/debug',
};
