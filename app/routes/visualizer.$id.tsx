import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useOutletContext, useParams } from "react-router";
import { Box, Download, RefreshCcw, Share2, X } from "lucide-react";
import Button from "../../components/ui/Button";
import { generate3DView } from "../../lib/ai.action";
import { createProject, getProjectById } from "../../lib/puter.action";

interface AuthContext {
    userId?: string;
}

export interface DesignItem {
    id: string;
    name?: string;
    sourceImage: string;
    renderedImage?: string;
    renderedPath?: string;
    sourcePath?: string;
    publicPath?: string;
    timestamp?: string | number | Date;
    ownerId?: string | null;
    isPublic?: boolean;
}

const VisualizerId = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { userId } = useOutletContext<AuthContext>();

    const initialImage = location.state?.initialImage as string | undefined;

    const hasInitialGenerated = useRef(false);

    const [project, setProject] = useState<DesignItem | null>(null);
    const [isProjectLoading, setIsProjectLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [currentImage, setCurrentImage] = useState<string | null>(null);

    const handleBack = () => navigate("/");

    // 1. Fetch project on mount
    useEffect(() => {
        let isMounted = true;

        const loadProject = async () => {
            if (!id) {
                setIsProjectLoading(false);
                return;
            }

            setIsProjectLoading(true);

            const fetchedProject = await getProjectById({ id });

            if (!isMounted) return;

            if (fetchedProject) {
                setProject(fetchedProject as DesignItem);
                setCurrentImage(fetchedProject.renderedImage || fetchedProject.sourceImage || null);
            } else if (initialImage) {
                // Fallback for new project before save
                setProject({
                    id,
                    name: `Residence ${id}`,
                    sourceImage: initialImage,
                });
                setCurrentImage(initialImage);
            } else {
                setProject(null);
                setCurrentImage(null);
            }

            setIsProjectLoading(false);
            hasInitialGenerated.current = false;
        };

        loadProject();

        return () => {
            isMounted = false;
        };
    }, [id, initialImage]);

    // 2. Trigger 3D view generation once project data is available
    useEffect(() => {
        const sourceImg = project?.sourceImage || initialImage;

        if (
            isProjectLoading ||
            hasInitialGenerated.current ||
            !sourceImg
        ) {
            return;
        }

        if (project?.renderedImage) {
            setCurrentImage(project.renderedImage);
            hasInitialGenerated.current = true;
            return;
        }

        const runGeneration = async (item: DesignItem) => {
            if (!id || !item.sourceImage) return;
            hasInitialGenerated.current = true;

            try {
                setIsProcessing(true);
                const result = await generate3DView({ sourceImage: item.sourceImage });

                if (result.renderedImage) {
                    setCurrentImage(result.renderedImage);
                    const updatedItem = {
                        ...item,
                        renderedImage: result.renderedImage,
                        renderedPath: result.renderedPath,
                        timestamp: Date.now(),
                        ownerId: item.ownerId ?? userId ?? null,
                        isPublic: item.isPublic ?? false,
                    };

                    const saved = await createProject({ item: updatedItem, visibility: "private" });

                    if (saved) {
                        setProject(saved as DesignItem);
                        setCurrentImage(saved.renderedImage || result.renderedImage);
                    }
                }
            } catch (error) {
                console.error("Error generating 3D view:", error);
            } finally {
                setIsProcessing(false);
            }
        };

        if (project) {
            runGeneration(project);
        }
    }, [isProjectLoading, project, id, userId, initialImage]);

    const activeDisplayImage = currentImage || initialImage || project?.sourceImage;

    return (
        <div className="visualizer">
            <nav className="topbar">
                <div className="brand">
                    <Box className="logo" />
                    <span className="name">Roomify</span>
                </div>
                <Button variant="ghost" size="sm" onClick={handleBack} className="exit">
                    <X className="icon" /> Exit Editor
                </Button>
            </nav>

            <section className="content">
                <div className="panel">
                    <div className="panel-header">
                        <div className="panel-meta">
                            <p>Project</p>
                            <h2>{project?.name || `Residence ${id}`}</h2>
                            <p className="note">Created by You</p>
                        </div>
                    </div>
                    <div className="panel-actions">
                        <Button
                            size="sm"
                            onClick={() => {}}
                            className="export"
                            disabled={!activeDisplayImage}
                        >
                            <Download className="w-4 h-4 mr-2" /> Export
                        </Button>
                        <Button size="sm" onClick={() => {}} className="share">
                            <Share2 className="w-4 h-4 mr-2" /> Share
                        </Button>
                    </div>
                </div>

                <div className={`render-area ${isProcessing ? "is-processing" : ""}`}>
                    {activeDisplayImage ? (
                        <img src={activeDisplayImage} alt="AI Render" className="render-img" />
                    ) : (
                        <div className="render-placeholder">
                            {initialImage && (
                                <img
                                    src={initialImage}
                                    alt="Original"
                                    className="render-fallback"
                                />
                            )}
                        </div>
                    )}
                    {isProcessing && (
                        <div className="render-overlay">
                            <div className="rendering-card">
                                <RefreshCcw className="spinner" />
                                <span className="title">Rendering...</span>
                                <span className="subtitle">
                                    Generating your 3D visualization
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
};

export default VisualizerId;