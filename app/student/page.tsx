"use client";

import { useEffect, useMemo, useState } from "react";
import { buildStudentNextAction } from "@/src/lib/student-next-action";
import { deferStateUpdate } from "@/src/lib/defer-state-update";
import {
  buildHistoryReviewSteps,
  buildInteractiveMessages
} from "@/src/lib/student-page-helpers";
import { stepNameMap } from "@/src/lib/step-names";
import { useStudentAuth } from "./_hooks/useStudentAuth";
import { useStudentOverview } from "./_hooks/useStudentOverview";
import { rememberLastActivity, syncActivityQuery, useStudentSession } from "./_hooks/useStudentSession";
import { useDraftEditor } from "./_hooks/useDraftEditor";
import { useStepStreaming } from "./_hooks/useStepStreaming";
import { useStudentStepActions } from "./_hooks/useStudentStepActions";
import { buildStudentGateView } from "./_hooks/buildStudentGateView";
import GroupWaitingStatus from "./_components/GroupWaitingStatus";
import NextActionCard from "./_components/NextActionCard";
import StudentProgressRail from "./_components/StudentProgressRail";
import { renderMessageHtml } from "./_components/renderMessageHtml";
import StudentLobby from "./_components/StudentLobby";
import HistoryReview from "./_components/HistoryReview";
import InteractionPanel from "./_components/InteractionPanel";
import Step68Panel from "./_components/Step68Panel";
import CoursePrepCard from "./_components/CoursePrepCard";
import CourseInfoBanner from "./_components/CourseInfoBanner";
import Step3InteractionCard from "./_components/Step3InteractionCard";
import MakeupOutlineCard from "./_components/MakeupOutlineCard";
import Step34OutlinePanel from "./_components/Step34OutlinePanel";
import Step5ReportCard from "./_components/Step5ReportCard";
import DebugLogCard from "./_components/DebugLogCard";

export default function StudentPage() {
  const [showDebugLog, setShowDebugLog] = useState(false);
  const [error, setError] = useState("");
  const { authReady, authError, loginUser, retryAuth } = useStudentAuth();
  const {
    profile,
    missingFields,
    classCourses,
    upcomingCourses,
    activeCourses,
    pausedCourses,
    participatedCourses,
    activityStatusMap,
    isLoadingOverview,
    refreshOverview,
    refreshActivityStatuses
  } = useStudentOverview({ authReady, loginUser, setError });
  const { session, setSession, applySessionSafely, preparingCourse, setPreparingCourse, joinActivity } =
    useStudentSession({
      authReady,
      loginUser,
      setError,
      refreshOverview,
      refreshActivityStatuses,
      isLoadingOverview,
      classCourses,
      upcomingCourses,
      activeCourses,
      pausedCourses
    });

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      deferStateUpdate(() => setShowDebugLog(params.get("debug") === "yes"));
    }
  }, []);

  const currentStep = session && loginUser
    ? session.personalSteps?.[loginUser] ?? session.currentStep
    : session?.currentStep ?? 1;

  const sortedMessages = useMemo(
    () => [...(session?.messages ?? [])].sort((a, b) => a.at.localeCompare(b.at)),
    [session]
  );

  const interactiveMessages = useMemo(
    () => buildInteractiveMessages({ session, sortedMessages, loginUser, currentStep }),
    [session, sortedMessages, loginUser, currentStep]
  );

  const historyReviewSteps = useMemo(
    () => buildHistoryReviewSteps(stepNameMap, { session, sortedMessages, loginUser }),
    [loginUser, session, sortedMessages]
  );

  // One memo around the pure gate-view builder keeps prop identities stable
  // for memoized children across polling re-renders (#459).
  const gate = useMemo(
    () =>
      buildStudentGateView({
        session,
        loginUser,
        currentStep,
        activityStatusMap,
        lastInteractiveKind: interactiveMessages[interactiveMessages.length - 1]?.kind
      }),
    [session, loginUser, currentStep, activityStatusMap, interactiveMessages]
  );
  const {
    step3SubmittedOutlineMermaid,
    step4OutlineMermaid,
    teammateUsers,
    makeupOutlinePending,
    courseStatusBlockedMessage,
    currentMode,
    isInputEnabled,
    stepModeLine,
    activeGateKey,
    usernameToName,
    step3CompletedByMe,
    step4CompletedByMe,
    step4CompletedPeers,
    allStep4Completed,
    canReplyToQuestion,
    waitingGroupMembers,
    waitingAiForGroup,
    step1CompletedWaitingTeacher,
    step2CompletedWaitingTeacher,
    waitingStep3Members,
    groupPendingMemberNames,
    groupMemberNames,
    groupLabel,
    groupSubmittedCount,
    groupTotalCount,
    showGroupStatusCard,
    groupStatusTitle,
    groupStatusTone,
    ownStep7Report,
    ownStep10Report,
    isStep10ReportReady,
    stepOpeningText,
    step9QuestionTexts
  } = gate;

  const {
    draftText,
    setDraftText,
    isCompletingStep6,
    setIsCompletingStep6,
    isCompletingStep8,
    setIsCompletingStep8,
    step6RefUser,
    setStep6RefUser,
    refUser,
    setRefUser,
    saveArtifact,
    markDraftSaved,
    unsavedDraft6Chars,
    unsavedDraft8Chars,
    currentUnsavedDraftChars,
    draftSaveStatus
  } = useDraftEditor({ session, loginUser, currentStep, applySessionSafely, setError });

  const {
    step3StreamingText,
    setStep3StreamingText,
    step6StreamingText,
    setStep6StreamingText,
    step7StreamingText,
    setStep7StreamingText,
    step10StreamingText,
    step10LoadingDots
  } = useStepStreaming({ session, loginUser, currentStep, ownStep10Report, applySessionSafely, setError });

  const {
    text,
    setText,
    step9Answers,
    setStep9Answers,
    step3CompleteHint,
    makeupOutlineHint,
    isSendingMessage,
    isSuggestingStep6,
    sendMessage,
    submitStep9Batch,
    handleOutlineSave,
    completeOutlineTree,
    completeMakeupOutlineTree,
    reopenStep3Editing,
    completeStep4,
    requestStep6Suggestion,
    completeStep6ToStep8,
    completeStep8ToStep9
  } = useStudentStepActions({
    session,
    loginUser,
    currentStep,
    activityStatusMap,
    isInputEnabled,
    applySessionSafely,
    setError,
    draftText,
    saveArtifact,
    markDraftSaved,
    setIsCompletingStep6,
    setIsCompletingStep8,
    setStep3StreamingText,
    setStep6StreamingText,
    setStep7StreamingText
  });

  const currentActivity = useMemo(
    () => {
      const all = [...classCourses];
      if (preparingCourse) all.push(preparingCourse);
      return all.find((item) => item.id === session?.activityId) ?? preparingCourse;
    },
    [classCourses, preparingCourse, session?.activityId]
  );

  const nextAction = buildStudentNextAction({
    currentStep,
    currentMode,
    canReplyToQuestion,
    isSendingMessage,
    waitingAiForGroup,
    waitingGroupMembers,
    waitingGroupMemberNames: groupPendingMemberNames,
    step1CompletedWaitingTeacher,
    step2CompletedWaitingTeacher,
    step3CompletedByMe,
    waitingStep3Members,
    step4CompletedByMe,
    allStep4Completed,
    draftTextLength: draftText.trim().length,
    unsavedDraftChars: currentUnsavedDraftChars,
    step9AnsweredCount: step9Answers.filter((a) => a.trim().length > 0).length
  });

  if (!authReady) {
    return (
      <main>
        <div className="card card-info">
          <h2>正在確認登入狀態</h2>
          <small>系統正在連線，請稍候...</small>
        </div>
      </main>
    );
  }

  if (authError && !loginUser) {
    return (
      <main>
        <div className="card card-danger">
          <h2>暫時無法進入學生端</h2>
          <small>{authError}</small>
          <div className="row" style={{ marginTop: 12 }}>
            <div style={{ width: 180 }}>
              <button type="button" onClick={retryAuth}>
                重新確認登入
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main>
      {error ? (
        <div className="card card-danger">
          <small>{error}</small>
          {!session && loginUser ? (
            <div className="row" style={{ marginTop: 12 }}>
              <div style={{ width: 180 }}>
                <button type="button" className="secondary" onClick={() => refreshOverview()}>
                  重新整理課程清單
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {missingFields.length > 0 ? (
        <div className="card card-danger">
          <h2>資料警告</h2>
          <small>你的帳號資料不完整（{missingFields.join(", ")}），請向老師反映。</small>
        </div>
      ) : null}

      {!session ? (
        <StudentLobby
          isLoadingOverview={isLoadingOverview}
          profile={profile}
          classCourses={classCourses}
          activeCourses={activeCourses}
          upcomingCourses={upcomingCourses}
          pausedCourses={pausedCourses}
          participatedCourses={participatedCourses}
          onJoinActivity={joinActivity}
          onPrepareCourse={setPreparingCourse}
        />
      ) : null}

      {preparingCourse ? (
        <CoursePrepCard
          course={preparingCourse}
          onJoin={joinActivity}
          onRefresh={() => refreshOverview()}
          onLeave={() => setPreparingCourse(null)}
        />
      ) : null}

      {session ? (
        <>
          <CourseInfoBanner
            title={session.activityTitle ?? currentActivity?.title ?? "未命名課程"}
            genre={currentActivity?.genre ?? "—"}
            durationMinutes={currentActivity?.durationMinutes ?? "—"}
            classNumber={currentActivity?.classNumber ?? "—"}
            groupName={session.groupName ?? "—"}
            groupMemberNames={groupMemberNames}
            essayDescription={currentActivity?.essayDescription || "—"}
            supplemental={currentActivity?.supplemental || "—"}
            onBackToLobby={() => {
              setSession(null);
              setPreparingCourse(null);
              rememberLastActivity(null);
              syncActivityQuery(null);
              refreshOverview().catch(() => undefined);
            }}
          />

          <StudentProgressRail currentStep={currentStep} />
          <NextActionCard action={nextAction} />

          <HistoryReview
            steps={historyReviewSteps}
            step3SubmittedOutlineMermaid={step3SubmittedOutlineMermaid}
            step4OutlineMermaid={step4OutlineMermaid}
          />

          <div className="card">
            <h2>Step {currentStep} - {stepNameMap[currentStep] ?? "未知步驟"}</h2>
            <div style={{ marginTop: 8 }}>
              <span className="badge">{stepModeLine}</span>
            </div>
            {[1, 2, 3, 4, 6, 8, 9].includes(currentStep) && stepOpeningText ? (
              <p>
                <small>
                  <span dangerouslySetInnerHTML={{ __html: renderMessageHtml(stepOpeningText) }} />
                </small>
              </p>
            ) : null}
            {currentStep !== 10 ? (
              <p>
                <small>
                  {currentStep >= 5
                    ? "此階段為個人步調，系統會依你的完成狀態自動推進步驟（例如步驟 9 完成後自動進入步驟 10）。"
                    : "步驟切換由教師端控制，你的頁面會自動同步。"}
                </small>
              </p>
            ) : null}
            {currentStep === 10 ? (
              <>
                <hr style={{ border: 0, borderTop: "1px solid var(--line-soft)", margin: "10px 0" }} />
                <h3 style={{ margin: "0 0 8px" }}>總結報告</h3>
                {isStep10ReportReady ? (
                  <div style={{ marginTop: 4 }} dangerouslySetInnerHTML={{ __html: renderMessageHtml(ownStep10Report ?? "") }} />
                ) : step10StreamingText ? (
                  <div
                    style={{
                      marginTop: 4,
                      padding: "10px 12px",
                      border: "1px solid var(--line)",
                      borderRadius: 8,
                      background: "var(--surface-alt)",
                      fontSize: 14,
                      lineHeight: 1.6
                    }}
                  >
                    <small style={{ display: "block", marginBottom: 6, color: "var(--muted)", fontWeight: 600 }}>
                      AI 正在產生總結，這個步驟會花比較多的時間，請稍候{step10LoadingDots}
                    </small>
                    <div style={{ marginTop: 4 }} dangerouslySetInnerHTML={{ __html: renderMessageHtml(step10StreamingText) }} />
                  </div>
                ) : (
                  <small style={{ color: "var(--muted-soft)" }}>
                    AI 正在產生總結，這個步驟會花比較多的時間，請稍候{step10LoadingDots}
                  </small>
                )}
              </>
            ) : null}
          </div>

          {showGroupStatusCard ? (
            <GroupWaitingStatus
              currentStep={currentStep}
              activeGateKey={activeGateKey}
              groupLabel={groupLabel}
              memberNames={groupMemberNames}
              title={groupStatusTitle}
              tone={groupStatusTone}
              submittedCount={groupSubmittedCount}
              totalCount={groupTotalCount}
              pendingMembers={groupPendingMemberNames}
            />
          ) : null}

          {currentStep === 3 ? (
            <Step3InteractionCard
              interactiveMessages={interactiveMessages}
              step3StreamingText={step3StreamingText}
              isSendingMessage={isSendingMessage}
              step3CompletedByMe={step3CompletedByMe}
              waitingStep3Members={waitingStep3Members}
              isInputEnabled={isInputEnabled}
              canReplyToQuestion={canReplyToQuestion}
              text={text}
              onTextChange={setText}
              onSendMessage={sendMessage}
              onReopenStep3={() => reopenStep3Editing()}
            />
          ) : null}

          {(currentStep === 3 || currentStep === 4) && loginUser ? (
            <Step34OutlinePanel
              currentStep={currentStep as 3 | 4}
              loginUser={loginUser}
              participants={session.participants}
              teammateUsers={teammateUsers}
              outlines={session.outlines}
              refUser={refUser}
              onRefUserChange={setRefUser}
              step3CompletedByMe={step3CompletedByMe}
              step4CompletedByMe={step4CompletedByMe}
              waitingStep3Members={waitingStep3Members}
              step3CompleteHint={step3CompleteHint}
              onSave={handleOutlineSave}
              onCompleteStep3={completeOutlineTree}
            />
          ) : null}

          {currentStep === 6 && loginUser && makeupOutlinePending ? (
            <MakeupOutlineCard
              serverMermaid={session.outlines[loginUser] ?? ""}
              completeHint={makeupOutlineHint}
              onSave={handleOutlineSave}
              onComplete={completeMakeupOutlineTree}
            />
          ) : null}

          {(currentStep === 6 || currentStep === 8) && loginUser && !(currentStep === 6 && makeupOutlinePending) ? (
            <Step68Panel
              currentStep={currentStep as 6 | 8}
              participants={session.participants}
              outlines={session.outlines}
              draftText={draftText}
              onDraftChange={setDraftText}
              onSaveDraft={() => saveArtifact(currentStep === 6 ? "draft6" : "draft8", draftText)}
              onSuggest={requestStep6Suggestion}
              onCompleteStep8={completeStep8ToStep9}
              isSuggestingStep6={isSuggestingStep6}
              isCompletingStep6={isCompletingStep6}
              isCompletingStep8={isCompletingStep8}
              unsavedChars={currentStep === 6 ? unsavedDraft6Chars : unsavedDraft8Chars}
              saveStatus={draftSaveStatus}
              step6RefUser={step6RefUser || loginUser}
              onStep6RefUserChange={setStep6RefUser}
              step6StreamingText={currentStep === 6 ? step6StreamingText : undefined}
              step7StreamingText={currentStep === 6 ? step7StreamingText : undefined}
            />
          ) : null}

          {currentStep === 5 || currentStep === 7 ? (
            <Step5ReportCard
              currentStep={currentStep as 5 | 7}
              step5Report={loginUser ? session.reports?.step5?.[loginUser] : undefined}
              draftStep6={loginUser ? session.draftStep6[loginUser] : undefined}
              step7Report={ownStep7Report ?? undefined}
            />
          ) : null}

          {currentStep === 10 && isStep10ReportReady ? (
            <div className="card card-info">
              <h2>課程已完成</h2>
              <small>整個課程已經結束，請等待老師指示進行後續課程。</small>
            </div>
          ) : null}

          {currentStep !== 3 && currentStep !== 5 && currentStep !== 8 && currentStep !== 10 ? (
            <InteractionPanel
              currentStep={currentStep}
              currentMode={currentMode}
              interactiveMessages={interactiveMessages}
              participantDisplayNames={usernameToName}
              text={text}
              onTextChange={setText}
              onSendMessage={sendMessage}
              onSubmitStep9={submitStep9Batch}
              onCompleteStep4={completeStep4}
              onCompleteStep6={completeStep6ToStep8}
              isSendingMessage={isSendingMessage}
              waitingAiForGroup={waitingAiForGroup}
              waitingGroupMembers={waitingGroupMembers}
              step1CompletedWaitingTeacher={step1CompletedWaitingTeacher}
              step2CompletedWaitingTeacher={step2CompletedWaitingTeacher}
              step4CompletedByMe={step4CompletedByMe}
              allStep4Completed={allStep4Completed}
              step4CompletedPeers={step4CompletedPeers}
              isCompletingStep6={isCompletingStep6}
              isSuggestingStep6={isSuggestingStep6}
              isInputEnabled={isInputEnabled}
              canReplyToQuestion={canReplyToQuestion}
              courseStatusBlockedMessage={courseStatusBlockedMessage}
              step9Answers={step9Answers}
              onStep9AnswerChange={(idx, val) => {
                const next = [...step9Answers];
                next[idx] = val;
                setStep9Answers(next);
              }}
              step9QuestionTexts={step9QuestionTexts}
              error={error}
            />
          ) : null}

          {showDebugLog ? <DebugLogCard messages={sortedMessages} /> : null}
        </>
      ) : null}
    </main>
  );
}
