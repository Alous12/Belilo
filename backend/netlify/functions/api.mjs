import serverless from 'serverless-http';
import { withLambda } from '@netlify/aws-lambda-compat';
import { getStore } from '@netlify/blobs';
import { createApp } from '../../src/app.js';
import { createFirebaseCommerceStore, firebaseDatabase } from '../../src/firebase-store.js';
import { createNetlifyImageStore } from '../../src/image-store.js';
import { createFirestoreSecurityStore } from '../../src/security-store.js';

let invoke;

const invokeLambda = withLambda(async (event, context) => {
  if (!invoke) {
    if (process.env.BELILO_STORE !== 'firebase') throw new Error('Configura BELILO_STORE=firebase en Netlify.');
    if (!process.env.BELILO_ADMIN_TOKEN) throw new Error('Configura BELILO_ADMIN_TOKEN en Netlify.');
    const db = firebaseDatabase();
    const app = createApp({
      adminToken: process.env.BELILO_ADMIN_TOKEN,
      commerceStore: createFirebaseCommerceStore(db),
      imageStore: createNetlifyImageStore(getStore('belilo-images')),
      securityStore: createFirestoreSecurityStore(db),
      clientIdentity: req => req.get('x-belilo-client-ip') ?? 'unknown',
      frontendDir: null,
      imageMaxMb: 4,
    });
    invoke = serverless(app, { binary: ['image/jpeg', 'image/png', 'image/webp'] });
  }
  return invoke(event, context);
});

export default (request, context) => {
  const headers = new Headers(request.headers);
  headers.set('x-belilo-client-ip', context.ip ?? 'unknown');
  return invokeLambda(new Request(request, { headers }), context);
};

export const config = { path: '/api/*' };
