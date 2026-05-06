import { beforeEach, describe, expect, it, mock } from 'bun:test';

const getUserSettingsMock = mock(async () => ({ appearance: { activeThemeId: 'default-dark', activeIconThemeId: 'material-default' } }));
const saveUserSettingMock = mock(async () => {});

mock.module('./settings.service.ts', () => ({
  getUserSettings: getUserSettingsMock,
  saveUserSetting: saveUserSettingMock,
}));

const { getSettings, putSetting } = await import('./settings.controller.ts');

describe('settings controller', () => {
  beforeEach(() => {
    getUserSettingsMock.mockClear();
    saveUserSettingMock.mockClear();
  });

  it('retorna configuracoes do usuario autenticado', async () => {
    const reply = {
      send: mock((payload: unknown) => payload),
    };

    await getSettings(
      {
        session: {
          user: {
            userId: 'user-1',
          },
        },
      } as any,
      reply as any,
    );

    expect(getUserSettingsMock).toHaveBeenCalledWith('user-1');
  });

  it('valida e persiste uma secao de configuracoes', async () => {
    const reply = {
      code: mock((status: number) => reply),
      send: mock((payload?: unknown) => payload),
    };

    await putSetting(
      {
        session: {
          user: {
            userId: 'user-1',
          },
        },
        params: {
          key: 'layout',
        },
        body: {
          sidePanel: 'git',
        },
      } as any,
      reply as any,
    );

    expect(saveUserSettingMock).toHaveBeenCalledWith('user-1', 'layout', { sidePanel: 'git' });
    expect(reply.code).toHaveBeenCalledWith(204);
  });
});
