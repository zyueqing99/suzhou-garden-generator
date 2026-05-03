import { describe, expect, it } from 'vitest';
import type { PluginOption, UserConfig } from 'vite';
import config from '../vite.config';

describe('vite config', () => {
  it('registers a dev API handler for VectorEngine image requests', () => {
    const resolvedConfig = config as UserConfig;
    const plugins = flattenPlugins(resolvedConfig.plugins);

    expect(plugins.some((plugin) => plugin && 'name' in plugin && plugin.name === 'vectorengine-image-api')).toBe(true);
  });

  it('excludes local worktrees from test discovery', () => {
    const resolvedConfig = config as UserConfig;
    const testConfig = resolvedConfig.test as { exclude?: string[] } | undefined;

    expect(testConfig?.exclude).toContain('.worktrees/**');
  });

  it('uses a dedicated strict development port to avoid opening another Vite app', () => {
    const resolvedConfig = config as UserConfig;

    expect(resolvedConfig.server?.port).toBe(5188);
    expect(resolvedConfig.server?.strictPort).toBe(true);
  });
});

function flattenPlugins(plugins: UserConfig['plugins']): PluginOption[] {
  return plugins?.flatMap((plugin) => (Array.isArray(plugin) ? flattenPlugins(plugin) : [plugin])) ?? [];
}
