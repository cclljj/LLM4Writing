package tw.com.slsinfo.apps.demo;

import com.vladsch.flexmark.ext.abbreviation.AbbreviationExtension;
import com.vladsch.flexmark.ext.definition.DefinitionExtension;
import com.vladsch.flexmark.ext.footnotes.FootnoteExtension;
import com.vladsch.flexmark.ext.tables.TablesExtension;
import com.vladsch.flexmark.ext.typographic.TypographicExtension;
import com.vladsch.flexmark.html.HtmlRenderer;
import com.vladsch.flexmark.parser.Parser;
import com.vladsch.flexmark.parser.ParserEmulationProfile;
import com.vladsch.flexmark.util.ast.Node;
import com.vladsch.flexmark.util.data.MutableDataSet;
import org.apache.wicket.markup.html.basic.MultiLineLabel;
import org.apache.wicket.model.IModel;
import org.apache.wicket.model.Model;
import tw.com.slsinfo.basic.BasePanel;

import java.util.Arrays;

public class GPTPanel extends BasePanel {
    private final IModel<String> message;

    public GPTPanel(String id, IModel<String> model) {
        super(id, model);
        message = model;
    }

    public GPTPanel(String id, String model) {
        this(id, Model.of(model));
    }

    @Override
    protected void onInitialize() {
        super.onInitialize();
        MutableDataSet options = new MutableDataSet();
        options.setFrom(ParserEmulationProfile.KRAMDOWN);
        options.set(Parser.EXTENSIONS, Arrays.asList(
                AbbreviationExtension.create(),
                DefinitionExtension.create(),
                FootnoteExtension.create(),
                TablesExtension.create(),
                TypographicExtension.create()
        ));
        Parser parser = Parser.builder(options).build();
        HtmlRenderer renderer = HtmlRenderer.builder(options).softBreak("  ").build();

        // You can re-use parser and renderer instances
        Node document = parser.parse(message.getObject());
        add(new MultiLineLabel("gptmessage", renderer.render(document)).setEscapeModelStrings(false));
    }
}
