import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import * as cmd from '@/lib/admin/commands';
import { prisma } from '@/lib/db';
import { getMergedSettings } from '@/lib/settings';
import { parseVideoUrl } from '@/lib/video';
import { VideoPlayer } from '@/components/VideoPlayer';
import { makeAdmin } from './helpers';

describe('parseVideoUrl', () => {
  it.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', { provider: 'youtube', id: 'dQw4w9WgXcQ' }],
    ['https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s&list=PL123', { provider: 'youtube', id: 'dQw4w9WgXcQ' }],
    ['https://youtu.be/dQw4w9WgXcQ?si=abc', { provider: 'youtube', id: 'dQw4w9WgXcQ' }],
    ['https://m.youtube.com/watch?v=dQw4w9WgXcQ', { provider: 'youtube', id: 'dQw4w9WgXcQ' }],
    ['https://www.youtube.com/embed/dQw4w9WgXcQ', { provider: 'youtube', id: 'dQw4w9WgXcQ' }],
    ['https://www.youtube.com/shorts/dQw4w9WgXcQ', { provider: 'youtube', id: 'dQw4w9WgXcQ' }],
    ['https://www.youtube.com/live/dQw4w9WgXcQ', { provider: 'youtube', id: 'dQw4w9WgXcQ' }],
    ['https://vimeo.com/76979871', { provider: 'vimeo', id: '76979871' }],
    ['https://vimeo.com/76979871/8272103f6e', { provider: 'vimeo', id: '76979871', hash: '8272103f6e' }],
    ['https://player.vimeo.com/video/76979871?h=8272103f6e&badge=0', { provider: 'vimeo', id: '76979871', hash: '8272103f6e' }],
    ['https://vimeo.com/channels/staffpicks/76979871', { provider: 'vimeo', id: '76979871' }],
  ])('accepts %s', (url, expected) => {
    expect(parseVideoUrl(url)).toEqual(expected);
  });

  it.each([
    'not a url',
    'javascript:alert(1)',
    'https://example.com/watch?v=dQw4w9WgXcQ',
    'https://www.youtube.com/watch?v=short',
    'https://www.youtube.com/playlist?list=PL123',
    'https://www.youtube.com/@somechannel',
    'https://vimeo.com/channels/staffpicks',
    'https://dailymotion.com/video/x7tgad0',
    'ftp://youtu.be/dQw4w9WgXcQ',
  ])('rejects %s', (url) => {
    expect(parseVideoUrl(url)).toBeNull();
  });
});

describe('Free Training video URL setting', () => {
  it('owner saves a YouTube URL; it persists and becomes the watch-page video', async () => {
    const owner = await makeAdmin('OWNER');
    await cmd.updateSettings(owner.actor, { freeTrainingVideoUrl: 'https://youtu.be/dQw4w9WgXcQ' });
    // A fresh read (as after a page refresh) returns the saved value.
    expect((await prisma.appSetting.findUnique({ where: { key: 'freeTrainingVideoUrl' } }))?.value).toBe('https://youtu.be/dQw4w9WgXcQ');
    expect((await getMergedSettings()).freeTraining.video).toMatchObject({ provider: 'youtube', id: 'dQw4w9WgXcQ', poster: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg' });
    expect(await prisma.auditLog.count({ where: { action: 'settings.update' } })).toBe(1);
  });

  it('owner saves an unlisted Vimeo URL (privacy hash kept), then updates it', async () => {
    const owner = await makeAdmin('OWNER');
    await cmd.updateSettings(owner.actor, { freeTrainingVideoUrl: 'https://vimeo.com/76979871/8272103f6e' });
    expect((await getMergedSettings()).freeTraining.video).toMatchObject({ provider: 'vimeo', id: '76979871', hash: '8272103f6e' });
    await cmd.updateSettings(owner.actor, { freeTrainingVideoUrl: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ' });
    expect((await getMergedSettings()).freeTraining.video).toMatchObject({ provider: 'youtube', id: 'aqz-KE-bpKQ' });
  });

  it('rejects invalid or unsupported URLs and keeps the previous value', async () => {
    const owner = await makeAdmin('OWNER');
    await cmd.updateSettings(owner.actor, { freeTrainingVideoUrl: 'https://youtu.be/dQw4w9WgXcQ' });
    for (const bad of ['hello', 'https://example.com/video.mp4', 'javascript:alert(1)', 'https://www.youtube.com/playlist?list=PL1']) {
      await expect(cmd.updateSettings(owner.actor, { freeTrainingVideoUrl: bad })).rejects.toThrow(/valid YouTube or Vimeo/);
    }
    expect((await getMergedSettings()).freeTraining.video?.id).toBe('dQw4w9WgXcQ');
  });

  it('an empty URL clears the video; the watch page shows the fallback message', async () => {
    const owner = await makeAdmin('OWNER');
    await cmd.updateSettings(owner.actor, { freeTrainingVideoUrl: 'https://youtu.be/dQw4w9WgXcQ' });
    await cmd.updateSettings(owner.actor, { freeTrainingVideoUrl: '' });
    const video = (await getMergedSettings()).freeTraining.video;
    expect(video).toBeNull();
    const html = renderToStaticMarkup(createElement(VideoPlayer, { video, label: 'Play the free training' }));
    expect(html).toContain('Training video is not available yet.');
    expect(html).not.toMatch(/site settings|YouTube\/Vimeo ID/); // no admin instructions shown to visitors
  });

  it('saving the video URL leaves the other site settings untouched', async () => {
    const owner = await makeAdmin('OWNER');
    await cmd.updateSettings(owner.actor, { contactEmail: 'support@surajmore.in' });
    await cmd.updateSettings(owner.actor, { freeTrainingVideoUrl: 'https://youtu.be/dQw4w9WgXcQ' });
    expect((await getMergedSettings()).contact.email).toBe('support@surajmore.in');
  });

  it.each(['ADMIN', 'VIEWER'] as const)('%s cannot change it (owner only)', async (role) => {
    const admin = await makeAdmin(role);
    await expect(cmd.updateSettings(admin.actor, { freeTrainingVideoUrl: 'https://youtu.be/dQw4w9WgXcQ' })).rejects.toThrow(/permission/);
    expect(await prisma.appSetting.count({ where: { key: 'freeTrainingVideoUrl' } })).toBe(0);
  });
});
