package tw.com.slsinfo.panel;

import org.apache.wicket.authroles.authorization.strategies.role.metadata.MetaDataRoleAuthorizationStrategy;
import org.apache.wicket.markup.html.WebMarkupContainer;
import org.apache.wicket.markup.html.link.BookmarkablePageLink;
import org.apache.wicket.markup.html.link.Link;
import org.apache.wicket.markup.html.panel.Panel;
import org.apache.wicket.model.IModel;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tw.com.slsinfo.HomePage;
import tw.com.slsinfo.apps.course.ClassGroupPage;
import tw.com.slsinfo.apps.course.EssayPage;
import tw.com.slsinfo.apps.learning.LearningPacePage;
import tw.com.slsinfo.apps.learning.MonitorPage;
import tw.com.slsinfo.apps.stlearning.ActivityPage;
import tw.com.slsinfo.apps.system.LogPage;
import tw.com.slsinfo.apps.system.UserMgmPage;
import tw.com.slsinfo.basic.BasePanel;
import tw.com.slsinfo.commons.model.IBuiltUserRoles;
import tw.com.slsinfo.essayai.models.ILLMUserRoles;

import java.io.Serial;
import java.util.List;

public class HeaderPanel extends BasePanel {
    private static final long serialVersionUID = 1L;
    private static Logger logger = LoggerFactory.getLogger(HeaderPanel.class);

    public HeaderPanel(String id) {
        super(id);
    }

    public HeaderPanel(String id, IModel<?> model) {
        super(id, model);
    }


    @Override
    protected void onInitialize() {
        super.onInitialize();

        Supervisor supervisor = new Supervisor("supervisor");
        Teacher teacher = new Teacher("teacher");
        Assistant assistant = new Assistant("assistant");
        Student student = new Student("student");

        MetaDataRoleAuthorizationStrategy.unauthorizeAll(supervisor, RENDER);
        MetaDataRoleAuthorizationStrategy.unauthorizeAll(teacher, RENDER);
        MetaDataRoleAuthorizationStrategy.unauthorizeAll(assistant, RENDER);
        MetaDataRoleAuthorizationStrategy.unauthorizeAll(student, RENDER);

        List<String> roles = getWicketSession().getRoleUsers();

        logger.debug("User  has roles {}", roles);

        if (!isSignedIn()) {
            add(new HeaderTopBar("headertopbar"));
            add(new UserLogoPanel("userlogo"));
        } else {
            add(new WebMarkupContainer("headertopbar"));
            add(new UserProfileShotCut("userlogo"));
        }
        add(new Link<>("home") {

            @Override
            public void onClick() {
                setResponsePage(HomePage.class);
            }
        });


        if (roles.contains(IBuiltUserRoles.SUPERVISOR)) {
            MetaDataRoleAuthorizationStrategy.authorize(supervisor, RENDER, IBuiltUserRoles.SUPERVISOR);
        } else if (roles.contains(ILLMUserRoles.TEACHER_ROLE)) {
            MetaDataRoleAuthorizationStrategy.authorize(teacher, RENDER, ILLMUserRoles.TEACHER_ROLE);
        } else if (roles.contains(IBuiltUserRoles.STUDENT)) {
            MetaDataRoleAuthorizationStrategy.authorize(student, RENDER, IBuiltUserRoles.STUDENT);
        } else if (roles.contains(ILLMUserRoles.RESEARCH_ASSISTANT)) {
            MetaDataRoleAuthorizationStrategy.authorize(supervisor, RENDER, IBuiltUserRoles.SUPERVISOR);
        }


        add(supervisor);
        add(teacher);
        add(assistant);
        add(student);

    }


    /**
     * 系統管理者
     */
    private class Supervisor extends Panel {

        @Serial
        private static final long serialVersionUID = 4719875788862556291L;

        public Supervisor(String id) {
            super(id);
        }

        @Override
        protected void onInitialize() {
            super.onInitialize();
            addSystem(this);
            addCourse(this);
            addLearning(this);
        }
    }

    /**
     * 教師
     */
    private class Teacher extends Panel {

        @Serial
        private static final long serialVersionUID = 4719875788862556291L;

        public Teacher(String id) {
            super(id);
        }

        @Override
        protected void onInitialize() {
            super.onInitialize();
            addCourse(this);
            addSystem(this);
            //addLearning(this);
        }
    }

    /**
     * 研究助理
     */
    private class Assistant extends Panel {

        @Serial
        private static final long serialVersionUID = 4719875788862556291L;

        public Assistant(String id) {
            super(id);
        }

        @Override
        protected void onInitialize() {
            super.onInitialize();
            addSystem(this);
            addLearning(this);
        }
    }

    /**
     * 學生
     */
    private class Student extends Panel {

        @Serial
        private static final long serialVersionUID = 4719875788862556291L;

        public Student(String id) {
            super(id);
        }

        @Override
        protected void onInitialize() {
            super.onInitialize();
            addStLearn(this);
        }
    }

    /**
     * 系統管理
     */
    private void addSystem(Panel panel) {
        Link<Void> logs = new BookmarkablePageLink<>("logs", LogPage.class);
        Link<Void> accountMgm = new BookmarkablePageLink<>("accountMgm", UserMgmPage.class);
        panel.add(accountMgm).add(logs);
    }


    /**
     * 課程管理
     *
     * @param panel
     */
    private void addCourse(Panel panel) {
        Link<Void> essay = new BookmarkablePageLink<>("essay", EssayPage.class);
        Link<Void> classgroup = new BookmarkablePageLink<>("classgroup", ClassGroupPage.class);
        panel.add(essay).add(classgroup);
    }

    /**
     * 學習管理
     *
     * @param panel
     */
    private void addLearning(Panel panel) {
        Link<Void> monitor = new BookmarkablePageLink<>("monitor", MonitorPage.class);
        Link<Void> learningpace = new BookmarkablePageLink<>("learningpace", LearningPacePage.class);
        panel.add(monitor).add(learningpace);
    }

    /**
     * 線上學習，學生專用
     *
     * @param panel
     */
    private void addStLearn(Panel panel) {
        Link<Void> activity = new BookmarkablePageLink<>("activity", ActivityPage.class);
        //Link<Void> progress = new BookmarkablePageLink<>("progress", ProgressPage.class);
        panel.add(activity);
    }
}
