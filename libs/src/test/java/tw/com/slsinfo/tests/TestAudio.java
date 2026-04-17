package tw.com.slsinfo.tests;

import com.openai.models.audio.AudioModel;
import tw.com.slsinfo.essayai.services.OpenAIAPIService;

import javax.sound.sampled.*;
import java.io.File;
import java.io.IOException;
import java.util.Arrays;
import java.util.List;

public class TestAudio {
    public static void main(String[] args) {
        TargetDataLine line = null;
        AudioFormat openedFormat = null;

        // 可嘗試的錄音格式清單（依序嘗試）
        List<AudioFormat> candidates = Arrays.asList(
                fmt(48000f, 16, 1, true, false),
                fmt(44100f, 16, 1, true, false),
                fmt(48000f, 16, 1, true, true),
                fmt(44100f, 16, 1, true, true)
        );

        try {
            // 1) 依序尋找可用的 TargetDataLine
            for (AudioFormat f : candidates) {
                DataLine.Info info = new DataLine.Info(TargetDataLine.class, f);
                if (AudioSystem.isLineSupported(info)) {
                    try {
                        line = (TargetDataLine) AudioSystem.getLine(info);
                        line.open(f);
                        openedFormat = f;
                        break;
                    } catch (LineUnavailableException ignore) {
                        // 換下一個候選格式
                    }
                }
            }
            if (line == null) {
                throw new IllegalStateException("找不到可用的錄音格式或輸入裝置。");
            }

            // 2) 準備輸出 WAV（WAV 需要 little-endian PCM_SIGNED）
            AudioFormat wavFormat = new AudioFormat(
                    AudioFormat.Encoding.PCM_SIGNED,
                    openedFormat.getSampleRate(),
                    openedFormat.getSampleSizeInBits(),
                    openedFormat.getChannels(),
                    (openedFormat.getSampleSizeInBits() / 8) * openedFormat.getChannels(),
                    openedFormat.getSampleRate(),
                    false // little-endian
            );

            // 來源串流（裝置實際格式）
            AudioInputStream srcStream = new AudioInputStream(line);
            // 轉成 WAV 友善格式（若已是 LE，轉換零成本直通）
            AudioInputStream wavStream = AudioSystem.getAudioInputStream(wavFormat, srcStream);

            File out = new File("recorded.wav");

            System.out.printf("使用格式：%.0f Hz, %d bit, %s, %s-endian%n",
                    openedFormat.getSampleRate(),
                    openedFormat.getSampleSizeInBits(),
                    openedFormat.getChannels() == 1 ? "mono" : "stereo",
                    openedFormat.isBigEndian() ? "big" : "little");

            // 3) 開始錄音並在背景寫檔（write 會阻塞直到 line 被關閉）
            line.start();
            Thread writer = new Thread(() -> {
                try {
                    AudioSystem.write(wavStream, AudioFileFormat.Type.WAVE, out);

                    // Test OpenAI
                    System.out.println(OpenAIAPIService.AudioTranscriptions(out, AudioModel.GPT_4O_MINI_TRANSCRIBE).text());
                } catch (IOException e) {
                    e.printStackTrace();
                }
            }, "wav-writer");
            writer.start();

            // 4) 停止條件：參數給秒數就自動停止；否則等使用者按 Enter
            if (args.length > 0) {
                try {
                    int seconds = Integer.parseInt(args[0]);
                    System.out.println("🎙️ 開始錄音... 將在 " + seconds + " 秒後自動停止");
                    Thread.sleep(seconds * 1000L);
                } catch (NumberFormatException e) {
                    System.out.println("🎙️ 開始錄音...（按 Enter 停止）");
                    System.in.read();
                }
            } else {
                System.out.println("🎙️ 開始錄音...（按 Enter 停止）");
                System.in.read();
            }

            // 5) 收尾：停止並關閉 line，等待寫檔完成
            line.stop();
            line.close();
            writer.join();

            System.out.println("✅ 已儲存：" + out.getAbsolutePath());

        } catch (Exception e) {
            e.printStackTrace();
            if (line != null && line.isOpen()) {
                line.stop();
                line.close();
            }
        }
    }

    private static AudioFormat fmt(float rate, int bits, int ch, boolean signed, boolean bigEndian) {
        return new AudioFormat(
                signed ? AudioFormat.Encoding.PCM_SIGNED : AudioFormat.Encoding.PCM_UNSIGNED,
                rate, bits, ch,
                (bits / 8) * ch,
                rate, bigEndian
        );
    }
}