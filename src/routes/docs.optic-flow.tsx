import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const Route = createFileRoute("/docs/optic-flow")({
  component: OpticFlowDocPage,
  head: () => ({
    meta: [
      { title: "Optic flow and kinesthetic movement — Aquafulness Docs" },
      {
        name: "description",
        content:
          "The perceptual design of Aquafulness: optic flow, vection and kinesthetic movement, and why watching sine-driven waves is designed to feel calming.",
      },
    ],
  }),
});

function OpticFlowDocPage() {
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
          Optic Flow and Kinesthetic Movement
        </h1>
      </div>

      <Alert>
        <AlertDescription className="text-muted-foreground">
          <strong className="text-foreground">Disclaimer:</strong> this page describes design
          reasoning, grounded in the personal experience of the project's creator and in generally
          known perceptual concepts used here as inspiration. It makes no medical claims.
          Aquafulness has not been clinically evaluated; nothing below asserts a therapeutic
          effect, and individual experience will vary.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>The design problem</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm leading-relaxed text-muted-foreground">
          <p>
            Real bathing is multisensory: skin temperature, buoyancy relieving the joints,
            hydrostatic pressure, the vestibular signal of being rocked, the sound of water, the
            sight of it. A screen and a speaker can address only two of those channels. The bet
            Aquafulness makes — the case study calls it <em>seeding</em> — is that sight and
            sound, done right, can cue the memory of the rest. The brain that has floated in a
            warm lake knows what that full sensory bundle feels like; a sufficiently evocative
            audiovisual fragment invites it to fill in the remainder.
          </p>
          <p>
            The question is what "done right" means. Aquafulness's answer has three parts:
            coherent optic flow, whole-field oscillation, and the sine wave as the common
            signature of calm water.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Optic flow: the visual signature of moving through water</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm leading-relaxed text-muted-foreground">
          <p>
            <strong className="text-foreground">Optic flow</strong> is the pattern of motion
            across the entire visual field that an observer experiences as they — or their
            surroundings — move. It is one of the strongest visual cues the brain uses to work out
            its own motion: a flow field expanding from a point ahead reads as moving forward; the
            whole scene translating gently upward reads as <em>you</em> sinking, and downward as
            rising.
          </p>
          <p>Aquafulness constructs its optic flow from three layers:</p>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              <strong className="text-foreground">Whole-field rocking.</strong> The camera's
              height rides a smooth periodic oscillation, so every pixel of the rendered image
              translates up and down together, with the smooth acceleration profile of a real
              swell. Whole-field coherent motion is exactly the stimulus class the visual system
              treats as evidence of <em>self</em>-motion rather than object motion.
            </li>
            <li>
              <strong className="text-foreground">Surface flow.</strong> The water's texture and
              displacement drift slowly and continuously across the surface. This is the classic
              laminar flow pattern of water moving past a floating observer — unhurried, uniform,
              endless. There is no destination and no event; the flow signals only that the water
              is alive and carrying you.
            </li>
            <li>
              <strong className="text-foreground">Undulation.</strong> The water surface itself
              rises and falls in an interference pattern of overlapping waves — in this app, a sum
              of sinusoids sampled from a directional wave spectrum — so nearby crests and far
              troughs move in the counter-phased way real swell does, giving the flow field
              believable depth structure rather than a flat scroll.
            </li>
          </ol>
          <p>
            Together these produce the specific optic-flow diet of a bather: global, slow,
            periodic, coherent. Nothing in the scene moves abruptly; nothing demands a saccade;
            nothing violates the prediction the last few seconds established. In the vocabulary of
            the case study, the visual channel is being fed a{" "}
            <strong className="text-foreground">pure sine oscillation</strong>.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vection and kinesthetic movement: seeing motion, feeling motion</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm leading-relaxed text-muted-foreground">
          <p>
            When a large portion of the visual field moves coherently, observers commonly
            experience <strong className="text-foreground">vection</strong> — the compelling
            illusion of self-motion in the absence of any physical movement (the railway-carriage
            effect: the train beside yours pulls away and <em>you</em> feel you are moving).
            Vection is the bridge from <em>watching</em> water to <em>feeling</em> carried by it.
          </p>
          <p>Aquafulness is deliberately built to invite a gentle, oscillatory vection:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              The rocking is applied to the <strong className="text-foreground">camera</strong>,
              not to objects in the scene, so the induced interpretation is "my body is bobbing,"
              not "that buoy is bobbing."
            </li>
            <li>
              The bob sits at the tempo of a slow, comfortable swell — the rhythm of a hammock or a
              slowly rocked cradle rather than of chop or turbulence. Slow rocking of this kind is
              widely associated, in everyday experience, with soothing; the case study grounds it
              more personally, in the feeling of being <em>held and cared for</em>, speculating
              that it may root as deep as prenatal experience.
            </li>
            <li>
              Wave height, speed and style are user-adjustable in the app's settings, because
              comfort thresholds differ — the same motion that reads as delicious swaying to one
              person is too much for another.
            </li>
          </ul>
          <p>
            The case study names the intended result directly: the projection moving smoothly like
            a wave should <em>"induce a kinesthetic perception of being immersed in water which
            flows with you back and forward"</em> — the bobbing movement, the sense of being cared
            for. <strong className="text-foreground">Kinesthetic</strong> here means the felt
            sense of one's own body's position and motion: the goal is not that the user{" "}
            <em>judges</em> the water looks nice, but that their body, at some level,{" "}
            <em>feels</em> rocked.
          </p>
          <p>Two design choices support comfort in this induced motion:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="text-foreground">Predictability.</strong> Sinusoidal motion is
              maximally predictable — the brain locks onto the rhythm within a cycle or two, so
              the visual-vestibular mismatch (the eyes report rocking, the inner ear reports
              stillness) stays gentle and expected. Erratic or accelerating motion with the same
              mismatch is what tends toward discomfort; a pure slow sine is about the mildest
              possible form of it.
            </li>
            <li>
              <strong className="text-foreground">A stable frame.</strong> On a phone or laptop
              screen, the device's bezel and the room beyond remain visible and stationary, which
              naturally limits vection to a pleasant, partial sensation rather than a
              destabilizing one. A fully enclosing display is correspondingly the setting where
              the floating illusion can become strongest.
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>The calming purpose: recreating the bath</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm leading-relaxed text-muted-foreground">
          <p>Why should any of this be calming? The case study's reasoning, offered as personal theory:</p>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              <strong className="text-foreground">Watching water is calming in itself.</strong>{" "}
              The sight of open water — the popularly termed "blue mind" observation — is soothing
              to most people, independent of any illusion of motion. Aquafulness leans into this
              with its natural palette: the light-brown-to-blue colors of a real lake or ocean,
              warm tones under translucent blue-green water, a saturation-lifted sky.
            </li>
            <li>
              <strong className="text-foreground">The common denominator of calm water is the
              sine wave.</strong> Everything a calm bath presents to the senses — the swell you
              feel, the lapping you hear, the flow you see — is smooth periodic oscillation. The
              theory is that presenting this same signature through the available channels (eyes
              and ears) entrains the observer toward the state the full-immersion version
              produces: the state the case study coins <strong className="text-foreground">"aquaful."</strong>
            </li>
            <li>
              <strong className="text-foreground">Association completes the picture.</strong> The
              experience is composed to match the memory of a specific, good place — floating in
              warm, open water. Sound reinforces sight: ocean and wind audio supply the auditory
              sine bed so the visuals don't have to carry the association alone. This is the
              audiovisual combination the case study identifies as the most effective seeding
              method — stronger than sound alone, which still taxes the imagination, and far
              cheaper cognitively than imagination alone.
            </li>
          </ol>
          <p>
            The purpose, then, is modest and specific:{" "}
            <strong className="text-foreground">
              to recreate, through visualization, the calming of bathing
            </strong>{" "}
            — the unhurried rocking, the living surface, the water light — for the many situations
            where real bathing is out of reach: the wrong hour, the wrong season, the wrong
            budget, a crowded pool, a body or mind that finds the facility difficult, or simply a
            five-minute pause at a desk.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What this is not</CardTitle>
        </CardHeader>
        <CardContent className="text-sm leading-relaxed text-muted-foreground">
          <p>
            It bears repeating outside the disclaimer: Aquafulness does not claim to lower blood
            pressure, treat anxiety, replace exercise, or produce any measured clinical effect. It
            is a visualization built on one person's careful attention to <em>why</em> bathing
            feels the way it does, and on well-worn perceptual ideas — optic flow, vection, the
            soothing quality of slow rhythm — used as craft, the way a filmmaker uses them, not as
            medicine. If it gives you three minutes of the ocean in the middle of winter, it has
            done its job.
          </p>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        See also:{" "}
        <Link to="/docs/background" className="underline hover:text-foreground">
          Background and purpose
        </Link>
      </p>
    </>
  );
}
