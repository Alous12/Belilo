import serverless from 'serverless-http';
import { getStore } from '@netlify/blobs';
import { createApp } from '../../src/app.js';
import { createFirebaseCommerceStore, firebaseDatabase } from '../../src/firebase-store.js';
import { createNetlifyImageStore } from '../../src/image-store.js';

let invoke;

export async function handler(event, context) {
  if (!invoke) {
    if (process.env.BELILO_STORE !== 'firebase') throw new Error('Configura BELILO_STORE=firebase en Netlify.');
    if (!process.env.BELILO_ADMIN_TOKEN) throw new Error('Configura BELILO_ADMIN_TOKEN en Netlify.');
    const app = createApp({
      adminToken: process.env.BELILO_ADMIN_TOKEN,
      commerceStore: createFirebaseCommerceStore(firebaseDatabase()),
      imageStore: createNetlifyImageStore(getStore('belilo-images')),
      imageMaxMb: 4,
    });
    invoke = serverless(app, { binary: ['image/jpeg', 'image/png', 'image/webp'] });
  }
  return invoke(event, context);
}
