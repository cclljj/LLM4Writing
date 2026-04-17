package tw.com.slsinfo.essayai.models.course;

import tw.com.slsinfo.commons.io.SerializeModel;

/**
 * 用來給LLM當成提示用語的問題庫
 */
public class LLMStageQuestionsModel extends SerializeModel {
    private Integer essayId;
    private String essayTitle;
    /**
     * 第N階段，active
     */
    private Integer stageId;
    private String stepName;
    /**
     * 第N個問題
     */
    private Integer stepSort;
    private Integer questionId;
    private String question;
    /**
     * <ul>
     *     <li>
     *         0:固定問題
     *     </li>
     *     <li>
     *         1:AI prompt
     *     </li>
     * </ul>
     */
    private Boolean type;

    public LLMStageQuestionsModel() {
    }


    public Integer getQuestionId() {
        return questionId;
    }

    public LLMStageQuestionsModel setQuestionId(Integer questionId) {
        this.questionId = questionId;
        return this;
    }

    public Integer getEssayId() {
        return essayId;
    }

    public LLMStageQuestionsModel setEssayId(Integer essayId) {
        this.essayId = essayId;
        return this;
    }

    public String getEssayTitle() {
        return essayTitle;
    }

    public LLMStageQuestionsModel setEssayTitle(String essayTitle) {
        this.essayTitle = essayTitle;
        return this;
    }

    public String getQuestion() {
        return question;
    }

    public LLMStageQuestionsModel setQuestion(String question) {
        this.question = question;
        return this;
    }

    public Integer getStageId() {
        return stageId;
    }

    public LLMStageQuestionsModel setStageId(Integer stageId) {
        this.stageId = stageId;
        return this;
    }

    public String getStepName() {
        return stepName;
    }

    public LLMStageQuestionsModel setStepName(String stepName) {
        this.stepName = stepName;
        return this;
    }

    public Integer getStepSort() {
        return stepSort;
    }

    public LLMStageQuestionsModel setStepSort(Integer stepSort) {
        this.stepSort = stepSort;
        return this;
    }

    public Boolean getType() {
        return type;
    }

    public LLMStageQuestionsModel setType(Boolean type) {
        this.type = type;
        return this;
    }
}
