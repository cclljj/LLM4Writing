package tw.com.slsinfo.essayai.models;

import tw.com.slsinfo.commons.io.SerializeModel;

public class ConfirmModel extends SerializeModel {

    ActionType actionType;


    public ConfirmModel() {
    }


    public ActionType getActionType() {
        return actionType;
    }

    public void setActionType(ActionType actionType) {
        this.actionType = actionType;
    }


}
