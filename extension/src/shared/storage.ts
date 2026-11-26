import type { PersonaProfile, WorkflowRecipe } from './types';

export interface PandaStorageSchema {
  personas: PersonaProfile[];
  activePersonaId: 'college' | 'personal';
  workflows: WorkflowRecipe[];
  sitePreferences: Record<string, Record<string, string>>;
}

const STORAGE_KEY = 'pandapilot_local_vault_v1';

export const DEFAULT_PERSONAS: PersonaProfile[] = [
  {
    id: 'college',
    label: 'College Persona',
    fullName: 'Mithin Krishna PS',
    email: 'mithinkrishna25@ssn.edu.in',
    phone: '+91 98401 22450',
    institution: 'SSN College of Engineering, Chennai',
    usn: '3122255002067',
  },
  {
    id: 'personal',
    label: 'Personal Persona',
    fullName: 'Mithin Krishna',
    email: 'mithin.builds@gmail.com',
    phone: '+91 98401 22450',
    institution: 'Independent Developer',
    usn: '',
  },
];

export const DEFAULT_WORKFLOWS: WorkflowRecipe[] = [
  {
    id: 'ssn-lms-lab-upload',
    name: 'SSN LMS Weekly Lab Submission',
    urlPattern: '*://lms.ssn.edu.in/*',
    steps: [
      { selector: 'select#course_id', action: 'fill', value: 'CS304', label: 'Select Course' },
      { selector: 'input[type="checkbox"]#integrity_ack', action: 'check', label: 'Confirm Integrity Declaration' },
    ],
  },
];

const DEFAULT_STORAGE: PandaStorageSchema = {
  personas: DEFAULT_PERSONAS,
  activePersonaId: 'college',
  workflows: DEFAULT_WORKFLOWS,
  sitePreferences: {},
};

export async function getVaultState(): Promise<PandaStorageSchema> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return DEFAULT_STORAGE;
  }

  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      const saved = result[STORAGE_KEY] as Partial<PandaStorageSchema> | undefined;
      if (!saved) {
        chrome.storage.local.set({ [STORAGE_KEY]: DEFAULT_STORAGE });
        resolve(DEFAULT_STORAGE);
        return;
      }
      resolve({
        personas: saved.personas?.length ? saved.personas : DEFAULT_PERSONAS,
        activePersonaId: saved.activePersonaId ?? 'college',
        workflows: saved.workflows ?? DEFAULT_WORKFLOWS,
        sitePreferences: saved.sitePreferences ?? {},
      });
    });
  });
}

export async function setActivePersonaId(id: 'college' | 'personal'): Promise<PandaStorageSchema> {
  const current = await getVaultState();
  const next: PandaStorageSchema = { ...current, activePersonaId: id };
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    await chrome.storage.local.set({ [STORAGE_KEY]: next });
  }
  return next;
}

export async function saveWorkflowRecipe(recipe: WorkflowRecipe): Promise<WorkflowRecipe[]> {
  const current = await getVaultState();
  const filtered = current.workflows.filter((w) => w.id !== recipe.id);
  const nextWorkflows = [recipe, ...filtered];
  const next: PandaStorageSchema = { ...current, workflows: nextWorkflows };
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    await chrome.storage.local.set({ [STORAGE_KEY]: next });
  }
  return nextWorkflows;
}

export async function saveSitePreference(
  hostname: string,
  fieldKey: string,
  value: string
): Promise<void> {
  const current = await getVaultState();
  const hostMap = { ...(current.sitePreferences[hostname] ?? {}), [fieldKey]: value };
  const next: PandaStorageSchema = {
    ...current,
    sitePreferences: { ...current.sitePreferences, [hostname]: hostMap },
  };
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    await chrome.storage.local.set({ [STORAGE_KEY]: next });
  }
}
