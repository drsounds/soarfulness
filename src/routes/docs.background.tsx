import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const Route = createFileRoute("/docs/background")({
  component: BackgroundDocPage,
  head: () => ({
    meta: [
      { title: "Background and purpose — Aquafulness Docs" },
      {
        name: "description",
        content:
          "Digital bathing, the Aquafulness case study, the seeding methodology, the sine-oscillation theory, and the 'aquaful' state.",
      },
    ],
  }),
});

function BackgroundDocPage() {
  return (
    <>
      <div>
        <Link
          to="/docs"
          className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Documentation
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Background and Purpose: Digital Bathing
        </h1>
      </div>

      <Alert>
        <AlertDescription className="text-muted-foreground">
          <strong className="text-foreground">Disclaimer:</strong> this page summarizes the{" "}
          <em>Aquafulness Case Study</em> and the personal experience and design theory of the
          project's creator. It contains no medical claims. Where effects on mood or relaxation
          are described, they describe subjective experience and design intent, not clinically
          established outcomes.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Why bathe digitally?</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm leading-relaxed text-muted-foreground">
          <p>
            Bathing is a rare kind of activity. Immersion in warm water engages many senses at
            once and, unlike most physical activity, produces sensations of calm, relaxation,
            weightlessness and gentle massage. For many people, time in the water is a cornerstone
            of well-being, and swimming has long been among the most popular of all leisure
            activities.
          </p>
          <p>
            But the case study behind Aquafulness catalogues an equally long list of barriers and
            downsides to real-world bathing:
          </p>

          <div>
            <h3 className="font-medium text-foreground">Safety</h3>
            <p>
              Drowning is the most serious danger of water, in pools and open water alike. Rescue
              that comes too late — or almost too late — can mean death or lifelong disability.
              This is why pools are staffed with lifeguards, enforce dress codes, and cap the
              number of bathers.
            </p>
          </div>

          <div>
            <h3 className="font-medium text-foreground">Hygiene</h3>
            <p>
              Shared water and shared facilities (locker rooms, floors, furniture) carry infection
              risks ranging from skin conditions to serious waterborne illness. The chlorine used
              to control germs brings its own concerns for regular bathers and for staff.
            </p>
          </div>

          <div>
            <h3 className="font-medium text-foreground">Dress codes and inclusivity</h3>
            <p>
              Hygiene and safety rules restrict pool clothing to swimwear textiles
              (lycra/spandex), since ordinary cotton clothing sheds particles, carries germs and —
              heavy with water — increases drowning risk. At the same time, a growing share of
              guests prefer, for religious, cultural or neurodiversity reasons, swimwear that
              covers the body more fully. The resulting tension has been genuinely contentious;
              facilities increasingly respond with full-cover swimwear (such as the burkini)
              available for hire, and with dedicated quiet or group-specific hours.
            </p>
          </div>

          <div>
            <h3 className="font-medium text-foreground">Availability</h3>
            <p>
              Unlike running or cycling, swimming requires infrastructure: a pool, or natural
              water with the right conditions. Pools are expensive to build and operate, are
              typically municipal, and keep limited hours. Natural water in a temperate climate
              like Sweden's averages 13–17 °C even at the July peak — cold enough that most of the
              year it is simply not an option — and open water brings currents, algae blooms and
              cold shock on top of absent supervision.
            </p>
          </div>

          <div>
            <h3 className="font-medium text-foreground">Cost</h3>
            <p>
              Entry fees to Swedish public baths have risen markedly with inflation and energy
              prices — typically 70–200 SEK per adult visit, with season passes at 1,500–3,000
              SEK. Even with discounts for students, retirees and prescription-based physical
              activity (FaR), prices are prohibitive for many.
            </p>
          </div>

          <div>
            <h3 className="font-medium text-foreground">Overcrowding</h3>
            <p>
              Because bathing is so popular, facilities and beaches crowd heavily outside office
              hours and on holidays — raising germ loads, collision and drowning risk, and noise
              that itself excludes people who find crowds difficult.
            </p>
          </div>

          <div>
            <h3 className="font-medium text-foreground">Travel</h3>
            <p>
              Chasing warm water abroad — Gran Canaria, Thailand, Mallorca — costs a Swedish
              household roughly 28,000–150,000 SEK for a week, increasingly financed on credit.
              Add visas, insurance against catastrophic hospital bills, unfamiliar legal systems,
              intense sun, and ocean hazards from rip currents to stinging aquatic life. The case
              study also notes that the geopolitical shocks of the 2020s — the pandemic, the war
              in Ukraine, escalation in the Middle East — have made travel abroad riskier and less
              certain than it has been in decades.
            </p>
          </div>

          <p>
            <strong className="text-foreground">The conclusion:</strong> bathing is double-edged.
            The pleasure, the calm and the exercise are real; so are the financial, hygienic,
            safety and availability barriers. The goal of Aquafulness is to recreate some of the
            most anticipated positive effects of bathing without the immersion — available at any
            hour, in any weather, to anyone with a screen.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Methodology: seeding the feeling of water</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm leading-relaxed text-muted-foreground">
          <p>
            To evoke the mental effect of bathing without water, the experience must activate the
            same associations the mind holds for real bathing. The case study's term for
            artificially inducing the bathing feeling is <strong className="text-foreground">seeding</strong>,
            and it surveys the main seeding channels:
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="text-foreground">Imagination</strong> — the most primitive
              method. It works, but demands freedom from distraction and is cognitively expensive;
              it succeeds best when the person is already relaxed.
            </li>
            <li>
              <strong className="text-foreground">Auditory stimulation</strong> — the most common
              method historically, from 1980s field-recording cassettes of ocean waves to modern
              generative soundscape apps. Effective, but it still leans on imagination to fill in
              the picture, which carries cognitive cost.
            </li>
            <li>
              <strong className="text-foreground">Visual stimulation</strong> — the sight of water
              is itself calming; the case study points to the popularly termed "blue mind" effect
              of gazing at the ocean.
            </li>
            <li>
              <strong className="text-foreground">Audiovisual combination</strong> — what works
              best. Sound and image reinforce each other, so neither channel has to carry the
              experience alone.
            </li>
          </ul>
          <p>Aquafulness is built on the audiovisual combination.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>The sine-oscillation theory and the "aquaful" state</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm leading-relaxed text-muted-foreground">
          <p>
            The case study then asks the deeper question: what actually is the soothing thing
            about water?
          </p>
          <p>
            Its answer — offered as a personal theory, not established science — is the{" "}
            <strong className="text-foreground">sine wave</strong>. The felt qualities of calm
            warm water — weightlessness, smoothness, the sense of being held, carried, and cared
            for, perhaps rooted as far back as prenatal experience — all share one physical
            signature: the flow and force of calm water is a sinusoidal oscillation. Whether you
            watch water move, hear it lap, or feel it carry you, the stimulus arriving at the
            senses is smooth, periodic, and predictable. The theory is that this oscillation{" "}
            <em>entrains</em> the observer toward the same calm.
          </p>
          <p>
            The case study coins the term <strong className="text-foreground">"aquaful"</strong>{" "}
            for the soothed state this stimulation induces.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>The fundamental algorithm</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm leading-relaxed text-muted-foreground">
          <p>From theory to design, the solution is stated plainly in the case study:</p>
          <blockquote className="border-l-2 border-border pl-4 italic">
            Create an audiovisual digital experience that resembles the point of view of a bather
            immersed in a warm lake. Emphasize the colors — the light-brown-to-blue nature of real
            water — and let that image be an overlay to a visual where the projection smoothly
            moves like a wave, to induce a kinesthetic perception of being immersed in water which
            flows with you back and forward — the sense of being cared for, the bobbing movement.
            <br />
            <br />
            <strong className="text-foreground not-italic">
              This is the fundamental algorithm.
            </strong>
          </blockquote>
          <p>Concretely, this becomes:</p>
          <ol className="list-decimal space-y-2 pl-5">
            <li>A first-person camera placed at bather height in an ocean or lake scene.</li>
            <li>
              The camera's position driven by smooth periodic motion, rocking the entire rendered
              image the way a floating body rocks.
            </li>
            <li>
              Water surfaces whose vertices and textures move in slow sinusoidal waves, in natural
              water colors.
            </li>
            <li>Ocean and wind audio loops underneath.</li>
          </ol>
          <p>
            This app ("Aquafulness Core") implements the same algorithm in the browser with
            three.js and WebGL — a from-the-ground-up rebuild of the original{" "}
            <a
              href="https://github.com/drsounds/aquafulness-2028"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              Godot-based Aquafulness
            </a>{" "}
            for the web. Why these techniques are expected to <em>feel</em> like floating is the
            subject of{" "}
            <Link to="/docs/optic-flow" className="underline hover:text-foreground">
              the perception page
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </>
  );
}
