package tw.com.slsinfo.essayai.utils;

/**
 * CT向度
 */
public enum ComputationalThinking {
    Interpretation("Interpretation"),
    Analysis("Analysis"),
    Inference("Inference"),
    Evaluation("Evaluation"),
    Explanation("Explanation"),
    SelfRegulation("SelfRegulation");
    String dimenstion;

    ComputationalThinking(String dimenstion) {
    }

    public String getDimenstion() {
        return dimenstion;
    }
}