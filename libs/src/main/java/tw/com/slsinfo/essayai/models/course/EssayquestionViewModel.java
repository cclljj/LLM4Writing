package tw.com.slsinfo.essayai.models.course;

import tw.com.slsinfo.essayai.databases.mysql.entities.Essayquestion;
import tw.com.slsinfo.essayai.databases.mysql.entities.Step;

import java.io.Serial;
import java.io.Serializable;
import java.time.Instant;

public class EssayquestionViewModel implements Serializable {
    @Serial
    private static final long serialVersionUID = 1L;

    private Integer id;
    private Integer essayId;
    private String essayTitle;
    private Integer stepId;
    private String stepName;
    private Integer stepSort;
    private String question;
    private Instant created;

    // 用於 DropDownChoice 的物件
    private Step stepObject;

    public static EssayquestionViewModel createNew(Essayquestion entity) {
        EssayquestionViewModel viewModel = new EssayquestionViewModel();
        viewModel.setId(entity.getId());
        viewModel.setEssayId(entity.getEssayid().getId());
        viewModel.setEssayTitle(entity.getEssayid().getTitle());
        viewModel.setStepId(entity.getStepid().getId());
        viewModel.setStepName(entity.getStepid().getStepname());
        viewModel.setStepSort(entity.getStepid().getStepsort());
        viewModel.setQuestion(entity.getQuestion());
        viewModel.setCreated(entity.getCreated());
        viewModel.setStepObject(entity.getStepid());
        return viewModel;
    }

    // Getters and Setters
    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public Integer getEssayId() {
        return essayId;
    }

    public void setEssayId(Integer essayId) {
        this.essayId = essayId;
    }

    public String getEssayTitle() {
        return essayTitle;
    }

    public void setEssayTitle(String essayTitle) {
        this.essayTitle = essayTitle;
    }

    public Integer getStepId() {
        return stepId;
    }

    public void setStepId(Integer stepId) {
        this.stepId = stepId;
    }

    public String getStepName() {
        return stepName;
    }

    public void setStepName(String stepName) {
        this.stepName = stepName;
    }

    public Integer getStepSort() {
        return stepSort;
    }

    public EssayquestionViewModel setStepSort(Integer stepSort) {
        this.stepSort = stepSort;
        return this;
    }

    public String getQuestion() {
        return question;
    }

    public void setQuestion(String question) {
        this.question = question;
    }

    public Instant getCreated() {
        return created;
    }

    public void setCreated(Instant created) {
        this.created = created;
    }

    public Step getStepObject() {
        return stepObject;
    }

    public void setStepObject(Step stepObject) {
        this.stepObject = stepObject;
        if (stepObject != null) {
            this.stepId = stepObject.getId();
            this.stepName = stepObject.getStepname();
            this.stepSort = stepObject.getStepsort();
        }
    }
}