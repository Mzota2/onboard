import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

import { Circle, FileEdit, CheckCircle2, Loader2, FileText, Users, ArrowRight, ArrowLeft } from "lucide-react";

import { useState} from "react";

import { AppShell } from "@/components/AppShell";

import { PortraitSilhouette } from "@/components/PortraitSilhouette";

import { QuestionManager } from "@/components/admin/AdminPipelinePanel";

import { useAuth } from "@/contexts/AuthContext";

import { useCandidates, usePositions } from "@/hooks/use-vetting-data";

import { updateCandidatePhase2Scores } from "@/lib/firebase/candidates";

import { createEvaluation, saveQuestionEvaluation, completeEvaluation } from "@/lib/firebase/evaluations";

import { requireAuth, requirePhase2Access } from "@/lib/route-guards";

import { useQueryClient } from "@tanstack/react-query";

import { toast } from "sonner";

import { z } from "zod";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";



const searchSchema = z.object({

  candidateId: z.string().optional(),

});



export const Route = createFileRoute("/phase2")({

  beforeLoad: async ({ search }) => {
    await requireAuth();
    if (search.candidateId) {
      await requirePhase2Access(search.candidateId);
    }
  },

  validateSearch: searchSchema,

  head: () => ({

    meta: [

      { title: "Phase 02: Live Interview · onboard" },

      { name: "description", content: "Synchronous live interview companion. Rapid rating across structural clarity, technical articulation, and pragmatic decision making." },

      { property: "og:title", content: "Phase 02: Live Interview" },

      { property: "og:description", content: "Synchronous interview rating companion." },

    ],

  }),

  component: Phase2Page,

});





function Phase2Page() {

  const { candidateId } = Route.useSearch();

  const navigate = useNavigate();

  const queryClient = useQueryClient();

  const { isAdmin, profile } = useAuth();

  const { data: positions = [] } = usePositions();

  const activePosition = positions[0];

  const { data: candidates = [] } = useCandidates(activePosition?.id);

  const candidate = candidates.find((c) => c.id === candidateId) ?? candidates.find((c) => c.promoted);

  // Prevent evaluation of disqualified candidates
  if (candidate?.disqualified) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center py-20">
          <p className="bp-label text-alert">Candidate Disqualified</p>
          <p className="mt-2 text-center text-[13px] text-muted-foreground">
            {candidate.name} has been disqualified and cannot be evaluated.
            {candidate.disqualifiedReason && ` Reason: ${candidate.disqualifiedReason}`}
          </p>
          <Link
            to="/"
            className="mt-4 border-2 border-ink bg-ink px-4 py-3 text-surface bp-press"
          >
            Return to Pipeline
          </Link>
        </div>
      </AppShell>
    );
  }

  // Prevent evaluation if Phase 2 results are released (unless admin)
  if (activePosition?.phase2ConsentReleased && !isAdmin) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center py-20">
          <p className="bp-label">Phase 2 Results Released</p>
          <p className="mt-2 text-center text-[13px] text-muted-foreground">
            Phase 2 results have been released to interviewers. Evaluation is now closed.
          </p>
          {candidateId ? (
            <Link
              to="/evaluation/phase2/$id"
              params={{ id: candidateId }}
              className="mt-4 border-2 border-ink bg-ink px-4 py-3 text-surface bp-press"
            >
              View Results
            </Link>
          ) : null}
        </div>
      </AppShell>
    );
  }

  const [activeTab, setActiveTab] = useState<"score" | "questions" | "review">("score");



  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");
  const [active, setActive] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submissionProgress, setSubmissionProgress] = useState<string>("");
  const [questionScores, setQuestionScores] = useState<Record<string, { criteria: Record<string, number>; notes: string }>>({});
  const [animationDirection, setAnimationDirection] = useState<'forward' | 'backward' | null>(null);

  

  // Use new unified questions structure if available, fallback to old structure

  const allQuestions = activePosition?.questions ?? [];

  const phase2Questions = activePosition?.phase2Questions ?? allQuestions.filter(q => q.phase === "phase2" || q.phase === "both");

  const questionCount = Math.max(phase2Questions.length, 1);

  const question = phase2Questions[active - 1] ?? {

    prompt: "No Phase 2 questions configured. An admin can add questions from the pipeline.",

    scenarioId: "",

  };

  

  // Get criteria from the question's scenario

  const scenario = activePosition?.scenarios?.find(s => s.id === question.scenarioId);

  const criteria = scenario?.criteria || [];

  // Check if current question is ready to proceed
  const canProceed = criteria.length > 0 && criteria.every(c => ratings[c.id] && ratings[c.id] > 0);

  // Validate current question before proceeding
  const validateCurrentQuestion = () => {
    const unratedCriteria = criteria.filter(c => !ratings[c.id] || ratings[c.id] === 0);
    if (unratedCriteria.length > 0) {
      toast.error("Please rate all criteria before proceeding");
      return false;
    }
    return true;
  };

  // Save current question to local state
  const saveCurrentQuestionToState = () => {
    setQuestionScores(prev => ({
      ...prev,
      [question.id]: {
        criteria: { ...ratings },
        notes,
      },
    }));
  };

  // Go to next question
  const goToNextQuestion = () => {
    if (!validateCurrentQuestion()) return;

    saveCurrentQuestionToState();

    if (active < phase2Questions.length) {
      setAnimationDirection('forward');
      setActive(active + 1);
      setRatings({});
      setNotes("");
    }
  };

  // Go to previous question
  const goToPreviousQuestion = () => {
    if (active > 1) {
      // Save current question before moving
      if (Object.keys(ratings).length > 0) {
        saveCurrentQuestionToState();
      }
      
      setAnimationDirection('backward');
      setActive(active - 1);
      
      // Load saved data for previous question
      const prevQuestion = phase2Questions[active - 2];
      const savedScore = questionScores[prevQuestion.id];
      if (savedScore) {
        setRatings(savedScore.criteria);
        setNotes(savedScore.notes);
      } else {
        setRatings({});
        setNotes("");
      }
    }
  };

  // Jump to specific question
  const goToQuestion = (index: number) => {
    // Save current question before moving
    if (Object.keys(ratings).length > 0) {
      saveCurrentQuestionToState();
    }
    
    const direction = index + 1 > active ? 'forward' : 'backward';
    setAnimationDirection(direction);
    setActive(index + 1);
    
    // Load saved data for target question
    const targetQuestion = phase2Questions[index];
    const savedScore = questionScores[targetQuestion.id];
    if (savedScore) {
      setRatings(savedScore.criteria);
      setNotes(savedScore.notes);
    } else {
      setRatings({});
      setNotes("");
    }
  };

  // const questionNav: readonly (number | "...")[] =

  //   phase2Questions.length === 0

  //     ? [1]

  //     : phase2Questions.length <= 7

  //       ? phase2Questions.map((q) => q.order)

  //       : [1, 2, 3, 4, 5, "...", phase2Questions.length];



  const handleSubmit = async () => {

    if (!candidate || !profile) return;

    // Save current question before submitting
    if (Object.keys(ratings).length > 0) {
      saveCurrentQuestionToState();
    }

    // Check if all questions have been evaluated
    const evaluatedQuestions = Object.keys(questionScores);
    if (evaluatedQuestions.length === 0) {
      toast.error("Please evaluate at least one question before submitting");
      return;
    }

    setSubmitting(true);
    setSubmissionProgress("Creating evaluation...");

    try {

      // Create evaluation record
      const evaluation = await createEvaluation({
        candidateId: candidate.id,
        positionId: activePosition?.id || "",
        interviewerId: profile.uid,
        interviewerName: profile.displayName || profile.email || "Unknown",
        phase: "phase2",
      });

      // Save all question scores
      const totalQuestions = Object.keys(questionScores).length;
      let currentQuestion = 0;
      for (const [questionId, scoreData] of Object.entries(questionScores)) {
        currentQuestion++;
        setSubmissionProgress(`Saving question ${currentQuestion} of ${totalQuestions}...`);
        const questionIndex = phase2Questions.findIndex(q => q.id === questionId);
        await saveQuestionEvaluation(evaluation.id, questionId, {
          questionId,
          criteria: {
            criteria: scoreData.criteria,
            notes: scoreData.notes,
          },
        }, questionIndex >= 0 ? questionIndex : 0);
      }

      setSubmissionProgress("Completing evaluation...");
      // Mark evaluation as complete
      await completeEvaluation(evaluation.id, "Phase 2 evaluation completed");

      setSubmissionProgress("Updating candidate status...");
      // Update candidate completion status
      await updateCandidatePhase2Scores(candidate.id, { phase2Complete: true });

      setSubmissionProgress("Refreshing data...");
      await queryClient.invalidateQueries({ queryKey: ["candidates"] });
      await queryClient.invalidateQueries({ queryKey: ["pipeline-stats"] });

      toast.success("Phase 2 evaluation submitted");
      navigate({ to: "/evaluation/phase2/$id", params: { id: candidate.id } });

    } catch {

      toast.error("Failed to submit evaluation");

    } finally {

      setSubmitting(false);
      setSubmissionProgress("");
    }

  };



  if (!candidate) {

    return (

      <AppShell>

        <Tabs value="review" className="w-full">

          <TabsList className={"grid w-full border-2 border-ink bg-surface mb-4 " + (isAdmin ? "grid-cols-3" : "grid-cols-2")}>

            <TabsTrigger value="score" disabled className="data-[state=active]:bg-ink data-[state=active]:text-surface">

              Score

            </TabsTrigger>

            {isAdmin && (

              <TabsTrigger value="questions" className="data-[state=active]:bg-ink data-[state=active]:text-surface">

                <FileText className="mr-1 h-3 w-3" /> Questions

              </TabsTrigger>

            )}

            <TabsTrigger value="review" className="data-[state=active]:bg-ink data-[state=active]:text-surface">

              <Users className="mr-1 h-3 w-3" /> Review

            </TabsTrigger>

          </TabsList>

          <TabsContent value="review">

            <div className="bp-card p-6 text-center">

              <p className="font-display text-lg font-bold uppercase">No candidate selected</p>

              <Link to="/candidate" className="mt-4 inline-block border-2 border-ink bg-ink px-4 py-2 font-mono text-[11px] uppercase text-surface">View candidates</Link>

            </div>

          </TabsContent>

          {isAdmin && (

            <TabsContent value="questions">

              <QuestionManager phaseKey="phase2Questions" position={activePosition} onSaved={async () => {

                await queryClient.invalidateQueries({ queryKey: ["positions"] });

              }} />

            </TabsContent>

          )}

        </Tabs>

      </AppShell>

    );

  }



  return (

    <AppShell>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">

        <TabsList className={"grid w-full border-2 border-ink bg-surface mb-4 " + (isAdmin ? "grid-cols-3" : "grid-cols-2")}>

          <TabsTrigger value="score" disabled={!candidate} className="data-[state=active]:bg-ink data-[state=active]:text-surface">

            Score

          </TabsTrigger>

          {isAdmin && (

            <TabsTrigger value="questions" className="data-[state=active]:bg-ink data-[state=active]:text-surface">

              <FileText className="mr-1 h-3 w-3" /> Questions

            </TabsTrigger>

          )}

          <TabsTrigger value="review" className="data-[state=active]:bg-ink data-[state=active]:text-surface">

            <Users className="mr-1 h-3 w-3" /> Review

          </TabsTrigger>

        </TabsList>



        <TabsContent value="score">

          {phase2Questions.length > 0 && (

            <>

              {/* Progress Bar */}

              <div className="mb-4">

                <div className="mb-2 flex items-center justify-between">

                  <p className="bp-meta text-[11px]">
                    Question {active} of {phase2Questions.length}
                  </p>
                  <p className="bp-meta text-[11px]">
                    {Math.round((active / phase2Questions.length) * 100)}% Complete
                  </p>
                </div>
                <div className="h-2 w-full bg-surface-dim border-2 border-ink">
                  <div 
                    className="h-full bg-ink transition-all duration-300" 
                    style={{ width: `${(active / phase2Questions.length) * 100}%` }}
                  />
                </div>

              </div>



              {/* Question Navigation */}
              <div className="mb-4 flex flex-wrap gap-2">
                {phase2Questions.map((q, index) => {
                  const isCurrent = index + 1 === active;
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => goToQuestion(index)}
                      className={`flex items-center gap-1 border-2 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest bp-press transition-all ${
                        isCurrent 
                          ? "bg-ink text-surface border-ink shadow-md" 
                          : "border-ink/30 text-muted-foreground hover:border-ink/60"
                      }`}
                    >
                      {isCurrent ? <CheckCircle2 className="h-3 w-3 text-green-600" /> : <div className="h-3 w-3 rounded-full border-2 border-current opacity-50" />}
                      Q{(index + 1).toString().padStart(2, "0")}
                    </button>
                  );
                })}
              </div>



              <div 
                key={active}
                className={`transition-all duration-500 ease-in-out ${
                  animationDirection === 'forward' 
                    ? 'animate-slide-in-right' 
                    : animationDirection === 'backward'
                    ? 'animate-slide-in-left'
                    : ''
                }`}
              >
              <article className="bp-card relative overflow-hidden p-5 text-center bp-scan bp-fade-up">

                <div className="mx-auto mb-3"><PortraitSilhouette kind={candidate.silhouette} /></div>

                <h2 className="font-display text-2xl font-extrabold tracking-tight uppercase">{candidate.name}</h2>

                <p className="bp-meta mt-1">{candidate.currentRole}</p>

                <div className="mt-3 inline-flex items-center gap-2 bg-ink px-3 py-1.5 text-surface">

                  <Circle className="h-2 w-2 fill-current bp-blink" />

                  <span className="font-mono text-[10px] tracking-widest uppercase">Live Phase: Technical Architecture</span>

                </div>

                <p className="bp-label mt-4">Current Question</p>

                <p className="font-display text-5xl font-extrabold">

                  {active.toString().padStart(2, "0")}<span className="text-muted-foreground/60 text-3xl">/{questionCount.toString().padStart(2, "0")}</span>

                </p>

              </article>



              <article className="bp-card-shadow p-5">

                <span className="inline-block border-2 border-ink bg-surface-dim px-2 py-1 font-mono text-[10px] tracking-widest uppercase">Technical Scenario</span>

                <h3 className="mt-3 font-display text-[22px] leading-snug font-extrabold tracking-tight">

                  {phase2Questions[active - 1]?.prompt ?? "No Phase 2 questions configured. An admin can add questions from the pipeline."}

                </h3>



                <div className="my-5 h-0.5 bg-ink/15" />



                <div className="space-y-5">

                  {criteria.length === 0 ? (

                    <p className="text-center text-[13px] text-muted-foreground">

                      No criteria configured for this question's scenario.

                    </p>

                  ) : (

                    criteria.map((c) => (

                      <div key={c.id}>

                        <div className="mb-2 flex items-start justify-between gap-2">

                          <div className="flex-1">

                            <h4 className="font-display text-[13px] font-bold uppercase tracking-tight">{c.name}</h4>

                            <p className="bp-meta text-[11px] mt-0.5">{c.description}</p>

                          </div>

                          <span className="shrink-0 border border-ink bg-surface-dim px-2 py-0.5 font-mono text-[10px] tracking-widest">

                            SCALE: 1-{c.scale}

                          </span>

                        </div>

                        <div className={`grid gap-2 ${"grid-cols-" + c.scale}`}>

                          {Array.from({ length: c.scale }, (_, i) => i + 1).map((n) => (

                            <button

                              key={n}

                              onClick={() => setRatings((r) => ({ ...r, [c.id]: n }))}

                              className="bp-rating"

                              data-active={ratings[c.id] === n}

                            >

                              {n}

                            </button>

                          ))}

                        </div>

                      </div>

                    ))

                  )}

                </div>

              </article>



              <article className="bp-card mt-5 p-5">

                <p className="bp-label flex items-center gap-2"><FileEdit className="h-3 w-3" /> Interviewer Notes</p>

                <textarea

                  value={notes}

                  onChange={(e) => setNotes(e.target.value)}

                  className="mt-3 block w-full resize-y border-2 border-ink bg-surface-dim p-3 font-sans text-[14px] placeholder:text-muted-foreground/70 focus:bg-surface focus:outline-none min-h-[140px]"

                  placeholder="Type detailed observations regarding the candidate's answer here..."

                />

              </article>
              </div>



              {/* Navigation Buttons */}

              <div className="mt-5 flex gap-3">

                <button 

                  type="button" 

                  onClick={goToPreviousQuestion} 

                  disabled={active === 1}

                  className="flex-1 flex items-center justify-center gap-2 border-2 border-ink px-4 py-3 font-mono text-[11px] uppercase tracking-widest bp-press disabled:opacity-40 disabled:cursor-not-allowed"

                >

                  <ArrowLeft className="h-4 w-4" />

                  Previous

                </button>

                

                {active === phase2Questions.length ? (

                  <button

                    type="button"

                    onClick={handleSubmit}

                    disabled={submitting || Object.keys(questionScores).length === 0}

                    className="flex-1 flex items-center justify-center gap-2 border-2 border-ink bg-ink px-4 py-3 text-surface font-mono text-[11px] uppercase tracking-widest bp-press disabled:opacity-60"

                  >

                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>{submissionProgress || "Submitting..."}</span>
                      </>
                    ) : (
                      <span>Submit Evaluation</span>
                    )}

                  </button>

                ) : (

                  <button 

                    type="button" 

                    onClick={goToNextQuestion} 

                    disabled={!canProceed}

                    className="flex-1 flex items-center justify-center gap-2 border-2 border-ink bg-ink px-4 py-3 text-surface font-mono text-[11px] uppercase tracking-widest bp-press disabled:opacity-60"

                  >

                    Next

                    <ArrowRight className="h-4 w-4" />

                  </button>

                )}

              </div>

            </>

          )}

        </TabsContent>



        {isAdmin && (

          <TabsContent value="questions">

            <QuestionManager phaseKey="phase2Questions" position={activePosition} onSaved={async () => {

              await queryClient.invalidateQueries({ queryKey: ["positions"] });

            }} />

          </TabsContent>

        )}



        <TabsContent value="review">

          <Link to="/candidate" className="block border-2 border-ink bg-ink px-4 py-4 text-center font-mono text-[12px] tracking-widest uppercase text-surface bp-press">

            View All Candidates

          </Link>

        </TabsContent>

      </Tabs>

    </AppShell>

  );

}

