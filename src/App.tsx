import { useEffect, useMemo, useState } from 'react';
import { GardenWorkspace } from './components/GardenWorkspace';
import { ProjectHistory } from './components/ProjectHistory';
import { createDefaultProject, type GardenProject, type ImageGeneration } from './domain/project';
import { createLocalProjectRepository } from './storage/localProjectRepository';
import './styles.css';

const repository = createLocalProjectRepository();

export default function App() {
  const [projects, setProjects] = useState<GardenProject[]>([]);
  const [activeProject, setActiveProject] = useState<GardenProject>(() => createDefaultProject());

  useEffect(() => {
    void repository.list().then((savedProjects) => {
      if (savedProjects.length > 0) {
        setProjects(savedProjects);
        setActiveProject(savedProjects[0]);
        return;
      }

      const project = createDefaultProject();
      setProjects([project]);
      setActiveProject(project);
      void repository.save(project);
    });
  }, []);

  const activeProjectId = activeProject.id;

  const saveProject = async (project: GardenProject) => {
    setActiveProject(project);
    setProjects((current) => [project, ...current.filter((item) => item.id !== project.id)].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)));
    await repository.save(project);
  };

  const handleCreateProject = () => {
    const project = createDefaultProject();
    void saveProject(project);
  };

  const handleOpenProject = async (projectId: string) => {
    const project = await repository.load(projectId);
    if (project) {
      setActiveProject(project);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    await repository.delete(projectId);
    const remaining = await repository.list();
    if (remaining.length === 0) {
      const project = createDefaultProject();
      await repository.save(project);
      setProjects([project]);
      setActiveProject(project);
      return;
    }

    setProjects(remaining);
    if (activeProjectId === projectId) {
      setActiveProject(remaining[0]);
    }
  };

  const handleGenerationAdded = (generation: ImageGeneration) => {
    void saveProject({
      ...activeProject,
      updatedAt: generation.createdAt,
      generations: [generation, ...activeProject.generations],
    });
  };

  const sortedProjects = useMemo(() => [...projects].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)), [projects]);

  return (
    <main className="app-shell v2-shell">
      <ProjectHistory
        projects={sortedProjects}
        activeProjectId={activeProject.id}
        onCreateProject={handleCreateProject}
        onOpenProject={handleOpenProject}
        onDeleteProject={handleDeleteProject}
      />
      <GardenWorkspace project={activeProject} onProjectChange={(project) => void saveProject(project)} onGenerationAdded={handleGenerationAdded} />
    </main>
  );
}
