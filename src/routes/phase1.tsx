import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";

import { Clock, Braces, Compass, ArrowRight, ArrowLeft, Loader2, UserPlus, FileText, Users } from "lucide-react";

import { useState} from "react";

import { AppShell } from "@/components/AppShell";

import { QuestionManager } from "@/components/admin/AdminPipelinePanel";

import { useAuth } from "@/contexts/AuthContext";

import { useCandidates, usePositions } from "@/hooks/use-vetting-data";

import { createCandidate, updateCandidatePhase1Scores } from "@/lib/firebase/candidates";

import { createEvaluation, saveQuestionEvaluation, completeEvaluation } from "@/lib/firebase/evaluations";

import { requireAuth } from "@/lib/route-guards";

import { useQueryClient } from "@tanstack/react-query";

import { toast } from "sonner";

import { z } from "zod";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";



const searchSchema = z.object({

  positionId: z.string().optional(),

  candidateId: z.string().optional(),

});



export const Route = createFileRoute("/phase1")({

  beforeLoad: requireAuth,

  validateSearch: searchSchema,

  head: () => ({

    meta: [{ title: "Phase 01: Questionnaire · onboard" }],

  }),

  component: Phase1Page,

});





function Phase1Page() {

  const navigate = useNavigate();

  const { profile, isAdmin } = useAuth();

  const { positionId, candidateId } = Route.useSearch();

  const queryClient = useQueryClient();

  const { data: positions = [] } = usePositions();

  const activePosition = positions.find((p) => p.id === positionId) ?? positions[0];

  const { data: candidates = [] } = useCandidates(activePosition?.id);

  const candidate = candidates.find((c) => c.id === candidateId);

  const [activeTab, setActiveTab] = useState<"add" | "score" | "questions" | "review">(candidate ? "score" : "add");

  const [name, setName] = useState("");

  const [code, setCode] = useState("");

  const [currentRole, setCurrentRole] = useState("");

  const [notes, setNotes] = useState("");

  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [activeQuestion, setActiveQuestion] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submissionProgress, setSubmissionProgress] = useState<string>("");
  const [questionScores, setQuestionScores] = useState<Record<string, { criteria: Record<string, number>; notes: string }>>({});
  const [animationDirection, setAnimationDirection] = useState<'forward' | 'backward' | null>(null);



  // Use new unified questions structure if available, fallback to old structure

  const allQuestions = activePosition?.questions ?? [];

  const phase1Questions = activePosition?.phase1Questions ?? allQuestions.filter(q => q.phase === "phase1" || q.phase === "both");

  const question = phase1Questions[activeQuestion - 1] ?? {

    prompt: "No Phase 1 questions configured. An admin can add questions from the pipeline.",

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

    if (activeQuestion < phase1Questions.length) {
      setAnimationDirection('forward');
      setActiveQuestion(activeQuestion + 1);
      setRatings({});
      setNotes("");
    }
  };



  // Go to previous question
  const goToPreviousQuestion = () => {
    if (activeQuestion > 1) {
      // Save current question before moving
      if (Object.keys(ratings).length > 0) {
        saveCurrentQuestionToState();
      }
      
      setAnimationDirection('backward');
      setActiveQuestion(activeQuestion - 1);
      
      // Load saved data for previous question
      const prevQuestion = phase1Questions[activeQuestion - 2];
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
  // const goToQuestion = (index: number) => {
  //   // Save current question before moving
  //   if (Object.keys(ratings).length > 0) {
  //     saveCurrentQuestionToState();
  //   }
    
  //   const direction = index + 1 > activeQuestion ? 'forward' : 'backward';
  //   setAnimationDirection(direction);
  //   setActiveQuestion(index + 1);
    
  //   // Load saved data for target question
  //   const targetQuestion = phase1Questions[index];
  //   const savedScore = questionScores[targetQuestion.id];
  //   if (savedScore) {
  //     setRatings(savedScore.criteria);
  //     setNotes(savedScore.notes);
  //   } else {
  //     setRatings({});
  //     setNotes("");
  //   }
  // };

  const handleAddCandidate = async () => {

    if (!activePosition || !name.trim() || !code.trim()) {

      toast.error("Name and candidate code are required");

      return;

    }

    setSubmitting(true);

    try {

      const created = await createCandidate({

        positionId: activePosition.id,

        name: name.trim(),

        code: code.trim().toUpperCase(),

        currentRole: currentRole.trim() || "Candidate",

      });

      await queryClient.invalidateQueries({ queryKey: ["candidates"] });

      toast.success("Candidate added");

      navigate({ to: "/phase1", search: { positionId: activePosition.id, candidateId: created.id } });

      setActiveTab("score");

    } catch {

      toast.error("Failed to add candidate");

    } finally {

      setSubmitting(false);

    }

  };



  const handleSubmitScores = async () => {
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
        phase: "phase1",
      });

      // Save all question scores
      const totalQuestions = Object.keys(questionScores).length;
      let currentQuestion = 0;
      for (const [questionId, scoreData] of Object.entries(questionScores)) {
        currentQuestion++;
        setSubmissionProgress(`Saving question ${currentQuestion} of ${totalQuestions}...`);
        const questionIndex = phase1Questions.findIndex(q => q.id === questionId);
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
      await completeEvaluation(evaluation.id, "Phase 1 evaluation completed");

      setSubmissionProgress("Updating candidate status...");
      // Update candidate completion status
      await updateCandidatePhase1Scores(candidate.id, { phase1Complete: true });

      setSubmissionProgress("Refreshing data...");
      await queryClient.invalidateQueries({ queryKey: ["candidates"] });
      await queryClient.invalidateQueries({ queryKey: ["pipeline-stats"] });

      toast.success("Phase 1 evaluation submitted");
      navigate({ to: "/evaluation/phase1/$id", params: { id: candidate.id } });
    } catch (error: any){
      console.log(error)
      toast.error("Failed to save scores");
    } finally {
      setSubmitting(false);
      setSubmissionProgress("");
    }
  };

  if (!activePosition) {

    return (

      <AppShell>

        <div className="bp-card p-6 text-center">

          <p className="font-display text-lg font-bold uppercase">No active position</p>

          <p className="mt-2 text-sm text-muted-foreground">An admin must create a position first.</p>

        </div>

      </AppShell>

    );

  }



  return (

    <AppShell>

      <div className="bp-fade-up">

        <p className="bp-meta flex items-center gap-2"><Compass className="h-3 w-3" /> {activePosition.code}</p>

        <h1 className="mt-2 font-display text-[34px] leading-[0.95] font-extrabold tracking-tight uppercase">

          Phase 01:<br />Questionnaire

        </h1>

        <div className="mt-3 bg-ink px-3 py-2 font-mono text-[12px] tracking-widest uppercase text-surface">

          {candidate ? `Candidate: ${candidate.name}` : "Add new candidate"}

        </div>

        <p className="bp-meta mt-3 flex items-center gap-2"><Clock className="h-3 w-3" /> Interviewer: {profile?.displayName}</p>

      </div>



      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">

        <TabsList className={"grid w-full border-2 border-ink bg-surface " + (isAdmin ? "grid-cols-4" : "grid-cols-3")}>

          <TabsTrigger value="add" className="data-[state=active]:bg-ink data-[state=active]:text-surface">

            <UserPlus className="mr-1 h-3 w-3" /> Add

          </TabsTrigger>

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



        <TabsContent value="add" className="mt-4">

        <article className="bp-card-shadow mt-2 p-5">

          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="mb-3 w-full border-2 border-ink px-3 py-2.5 focus:outline-none" />

          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Candidate code (SSA-01)" className="mb-3 w-full border-2 border-ink px-3 py-2.5 font-mono focus:outline-none" />

          <input value={currentRole} onChange={(e) => setCurrentRole(e.target.value)} placeholder="Current role / company" className="mb-4 w-full border-2 border-ink px-3 py-2.5 focus:outline-none" />

          <button type="button" onClick={handleAddCandidate} disabled={submitting} className="flex w-full items-center justify-between bg-ink px-4 py-4 text-surface bp-press disabled:opacity-60">

            <span className="font-mono text-[12px] tracking-widest uppercase">Register Candidate</span>

            <ArrowRight className="h-4 w-4" />

          </button>

        </article>

        </TabsContent>



        <TabsContent value="score" className="mt-4">

          {phase1Questions.length > 0 && (

            <>

              {/* Progress Bar */}

              <div className="mb-4 sticky top-0">

                <div className="mb-2 flex items-center justify-between">

                  <p className="bp-meta text-[11px]">
                    Question {activeQuestion} of {phase1Questions.length}
                  </p>
                  <p className="bp-meta text-[11px]">
                    {Math.round((activeQuestion / phase1Questions.length) * 100)}% Complete
                  </p>
                </div>
                <div className="h-2 w-full bg-surface-dim border-2 border-ink ">
                  <div 
                    className="h-full bg-ink transition-all duration-300" 
                    style={{ width: `${(activeQuestion / phase1Questions.length) * 100}%` }}
                  />
                </div>

              </div>



              {/* Question Navigation */}
              {/* <div className="mb-4 flex flex-wrap gap-2">
                {phase1Questions.map((q, index) => {
                  const isCurrent = index + 1 === activeQuestion;
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
              </div> */}



          <div 
            key={activeQuestion}
            className={`transition-all duration-500 ease-in-out ${
              animationDirection === 'forward' 
                ? 'animate-slide-in-right' 
                : animationDirection === 'backward'
                ? 'animate-slide-in-left'
                : ''
            }`}
          >
          <article className="bp-card-shadow mt-2 p-5">

            <div className="flex items-center justify-between">

              <span className="border-2 border-ink px-2 py-1 font-mono text-[11px] tracking-widest">

                Q{activeQuestion.toString().padStart(2, "0")} / {phase1Questions.length || 1}

              </span>

              <Braces className="h-5 w-5" />

            </div>

            <h2 className="mt-4 font-display text-[24px] leading-tight font-extrabold tracking-tight">{question.prompt}</h2>

            <div className="mt-5">

              <p className="bp-label mb-2">Interviewer Notes</p>

              <textarea

                value={notes}

                onChange={(e) => setNotes(e.target.value)}

                placeholder="Enter technical observations here..."

                className="block min-h-[100px] w-full resize-y border-2 border-ink bg-surface-dim p-3 font-sans text-[14px] placeholder:text-muted-foreground/70 focus:bg-surface focus:outline-none"

              />

            </div>

          </article>



          <article className="bp-card mt-5 p-5">

            <p className="bp-label border-b-2 border-ink pb-2">

              {scenario?.name || "Evaluation Criteria"}

            </p>

            {criteria.length === 0 ? (

              <p className="mt-4 text-center text-[13px] text-muted-foreground">

                No criteria configured for this question's scenario.

              </p>

            ) : (

              <div className="mt-4 space-y-5">

                {criteria.map((c) => (

                  <div key={c.id}>

                    <div className="mb-2 flex items-start justify-between gap-2">

                      <div className="flex-1">

                        <h3 className="font-display text-[15px] font-bold">{c.name}</h3>

                        <p className="bp-meta text-[11px] mt-0.5">{c.description}</p>

                      </div>

                      <span className="shrink-0 border border-ink bg-surface-dim px-2 py-0.5 font-mono text-[10px] tracking-widest">

                        SCALE: 1-{c.scale}

                      </span>

                    </div>

                    <div className={`grid gap-2 grid-cols-${c.scale}`}>

                      {Array.from({ length: c.scale || 5 }, (_, i) => i + 1).map((n) => (

                        <button

                          key={n}

                          type="button"

                          onClick={() => setRatings((r) => ({ ...r, [c.id]: n }))}

                          className="bp-rating"

                          data-active={ratings[c.id] === n}

                        >

                          {n}

                        </button>

                      ))}

                    </div>

                  </div>

                ))}

              </div>

            )}

          </article>
          </div>



          {/* Navigation Buttons */}

          <div className="mt-5 flex gap-3">

            <button 

              type="button" 

              onClick={goToPreviousQuestion} 

              disabled={activeQuestion === 1}

              className="flex-1 flex items-center justify-center gap-2 border-2 border-ink px-4 py-3 font-mono text-[11px] uppercase tracking-widest bp-press disabled:opacity-40 disabled:cursor-not-allowed"

            >

              <ArrowLeft className="h-4 w-4" />

              Previous

            </button>

            

            {activeQuestion === phase1Questions.length ? (

              <button

                type="button"

                onClick={handleSubmitScores}

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

          <TabsContent value="questions" className="mt-4">

            <QuestionManager phaseKey="phase1Questions" position={activePosition} onSaved={async () => {

              await queryClient.invalidateQueries({ queryKey: ["positions"] });

            }} />

          </TabsContent>

        )}



        <TabsContent value="review" className="mt-4">

          <Link to="/candidate" className="block border-2 border-ink bg-ink px-4 py-4 text-center font-mono text-[12px] tracking-widest uppercase text-surface bp-press">

            View All Candidates

          </Link>

        </TabsContent>

      </Tabs>

    </AppShell>

  );

}

