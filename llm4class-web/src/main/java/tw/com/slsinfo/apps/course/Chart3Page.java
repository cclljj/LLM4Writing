package tw.com.slsinfo.apps.course;

import com.openai.models.ChatModel;
import com.openai.models.responses.Response;
import com.openai.models.responses.ResponseInputItem;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.apache.logging.log4j.util.Strings;
import org.apache.wicket.markup.head.IHeaderResponse;
import org.apache.wicket.markup.head.OnDomReadyHeaderItem;
import org.apache.wicket.model.IModel;
import org.apache.wicket.request.mapper.parameter.PageParameters;
import org.wicketstuff.annotation.mount.MountPath;
import tw.com.slsinfo.basic.BaseChatPage;
import tw.com.slsinfo.essayai.models.openai.ChatPageModel;
import tw.com.slsinfo.essayai.services.OpenAIAPIService;
import tw.com.slsinfo.essayai.utils.OpenAIUtils;

import java.util.ArrayList;
import java.util.List;

@Deprecated
public class Chart3Page extends BaseChatPage {
    private static final long serialVersionUID = 1L;
    private static final Logger logger = LogManager.getLogger(Chart3Page.class);
    private String data;

    public Chart3Page(IModel<ChatPageModel> model,int currentStageId) {
        super(model, currentStageId);
    }

    public Chart3Page(PageParameters parameters) {
        super(parameters);
    }

    @Override
    protected void onInitialize() {
        super.onInitialize();
        List<ResponseInputItem> inputs = new ArrayList<>();

        inputs.add(ResponseInputItem.ofMessage(ResponseInputItem.Message.builder()
                .addInputTextContent("請根據「重點整理說明」，產出內容指定的資料。")
                .role(ResponseInputItem.Message.Role.SYSTEM)
                .build()));

        Response response = OpenAIAPIService.createResponse(ChatModel.GPT_4O_MINI, inputs, Strings.EMPTY, List.of("vs_689d4b512c948191b3533d7c05694466"));
        data = OpenAIUtils.getOutputText(response);
        logger.debug("data: {}", data);
    }

    @Override
    public void renderHead(IHeaderResponse response) {
        super.renderHead(response);

        // 初始化程式碼
        String js = """
            const chart = new d3.OrgChart()
                .container('.chart-container')
                .data(%s)
                .nodeContent(d => {
                    return `
                      <div style="padding:10px; border:1px solid #ccc; border-radius:8px; background:#fff;">
                        <div style="font-weight:bold; font-size:14px; margin-bottom:5px;">
                          ${d.data.title}
                        </div>
                        <div style="font-size:12px; color:#555;">
                          ${d.data.content}
                        </div>
                      </div>
                    `;
                  })
              .render();
            """.formatted(this.data);

        response.render(OnDomReadyHeaderItem.forScript(js));
    }

}
