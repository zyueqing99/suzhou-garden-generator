import { describe, expect, it } from 'vitest';
import { defaultGardenParameters } from './domain/project';
import { createDefaultRequirementConfirmation, resolveRequirementConfirmation, updateRequirementConfirmation } from './requirementConfirmation';

describe('requirementConfirmation', () => {
  it('creates editable defaults from garden parameters', () => {
    expect(createDefaultRequirementConfirmation(defaultGardenParameters)).toEqual({
      functionalNeeds: '紧凑游赏与停留',
      stylePreference: '典雅厅堂',
      landscapeElements: '水院为核',
      waterRatio: '38%',
      rockRatio: '46%',
      structureTypes: '厅堂、连廊、景亭',
      plantPreference: '松、竹、枫与水生植物偏密配置',
    });
  });

  it('keeps user edited values instead of overwriting them with defaults', () => {
    const edited = updateRequirementConfirmation(createDefaultRequirementConfirmation(defaultGardenParameters), 'stylePreference', '现代苏式');
    const resolved = resolveRequirementConfirmation({ ...defaultGardenParameters, buildingStyle: 'scholar' }, edited);

    expect(resolved.stylePreference).toBe('现代苏式');
    expect(resolved.landscapeElements).toBe('水院为核');
  });
});
