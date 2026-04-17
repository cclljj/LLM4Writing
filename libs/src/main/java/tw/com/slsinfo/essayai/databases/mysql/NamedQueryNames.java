package tw.com.slsinfo.essayai.databases.mysql;

/**
 * JPQL查詢代稱
 */
public interface NamedQueryNames {

    /**
     * 以schoolid尋找school
     */
    String FIND_SCHOOL_BY_SCHOOLID = "findSidBySchoolId";
    /**
     * 取得使用者角色名稱
     */
    String GETROLEUSER = "getRoleUser";

    /**
     * 取得使用者所有任職單位角色名稱
     */
    String GETANYROLEUSER = "getAnyRoleUser";

    /**
     * 根據角色及schoolid取得使用者清單
     */
    String FIND_ROLEUSER_BY_SID_RID = "findRoleUserBySidRid";

    /**
     * 取得使用者職稱
     */
    String GET_USER_TITLES_BY_UID = "getUserTitlesByUid";

    /**
     * 取得使用者職稱
     */
    String GET_USER_TITLES_BY_UID_SID = "getUserTitlesByUidSid";

    /**
     * 帳密驗證
     */
    String DOLOGIN = "doLogin";
    /**
     * 以角色名尋找role
     */
    String FIND_ROLE_BY_ROLENAME = "findRoleByName";

    /**
     * 找到所有非內建角色
     */
    String FIND_EXTRA_ROLE_GREAT_THAN_ROLEID = "findExtraRoleGreatThanRoleId";
    /**
     * 以頁面名尋找role名稱，以因應動態授權頁面
     */
    String FIND_ROLE_BY_COMPONENTCLASSNAME = "findRoleByComponentClassName";

    /**
     * 以Role ID找到所有的功能授權
     */
    String FIND_ROLEPERMISSION_BY_ROLEID = "findRolePermissionByRoleId";
    /**
     * 以Role IDs找到所有的功能授權
     */
    String FIND_ROLEPERMISSION_BY_ROLEIDS = "findRolePermissionByRoleIds";
    /**
     * 以Role ID找到客制化的功能授權
     */
    String FIND_EXTRA_ROLEPERMISSION_BY_ROLEID = "findExtraRolePermissionByRoleId";
    /**
     * 以builtin參數找到是否為客制化的功能授權
     */
    String FIND_EXTRA_ROLEPERMISSION_BY_BUILTIN = "findExtraRolePermissionByBuiltin";
    /**
     * 以builtin參數找到是否為客制化的功能授權
     */
    String FIND_DISTINCT_ROLEPERMISSION_BY_BUILTIN = "findDistinctRolePermissionByBuiltin";

    /**
     * 以UID尋找User
     */
    String FIND_USER_BY_UID = "findUserByUid";
    /**
     * 以職稱尋找Title
     */
    String FIND_TITLE_BY_TITLENAME = "findTitleByTitleName";

    /**
     * 刪除角色授權
     */
    String DELETE_ROLEPERMISSION_BY_ROLE_ID = "deleteRolePermissionByRoleId";

    /**
     * 以RoleId先刪除角色授權再繼續刪除角色
     */
    String DELETE_ROLE_ROLEPERMISSION_CASCADE_BY_ROLE_ID = "deleteRolePermissionCascadeByRoleId";

    /**
     * 以menuname查找authpage，因為menuname是唯一
     */
    String GET_AUTHPAGE_BY_MENUNAME = "getAuthPageByMenuName";
    /**
     * 以ap ids查找authpage
     */
    String GET_AUTHPAGE_BY_APIDS = "getAuthPageByApids";

    /**
     * 以sid查找classinfo
     */
    String GET_STU_CLASSINFO_BY_SID = "getStuClassinfoBySid";
    /**
     * 以uid查找學生使用者的分組ID
     */
    String GET_STU_GROUP_BY_UID = "getStuGroupByUid";

    /**
     * 依據寫作主題ID及學習階段ID取得問題庫
     */
    String GET_STAGE_QUESTIONS_BY_IDS = "getStageQuestionsByIds";

    /**
     * 依據寫作主題ID取得問題庫
     */
    String GET_STAGE_QUESTIONS_BY_EID = "getStageQuestionsByeId";
    /**
     * 以cid及cgid查詢學生目前活動進度
     */
    String GET_CURRENT_ACTIVITY_BY_CID_CGID = "getCurrentActivityByCidCgId";

    /**
     * 以階段名稱查詢stage
     */
    String GET_STAGE_BY_NAME = "getStageByName";

    String GET_ALL_STAGE = "getAllStages";
    String GET_STAGE = "getStages";
    /**
     * 以CT及寫作主題取得階段一的問題
     */
    String GET_QUESTIONS_BY_CT_TITLE = "getQuestionsByCTTitle";

    /**
     * 以寫作文主題取得階段一的問題
     */
    String GET_QUESTIONS_BY_TITLE = "getQuestionsByTitle";

}
