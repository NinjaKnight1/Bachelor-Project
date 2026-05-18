enum Gateway {
  Exclusive,
  Parallel
}

// Data petri net structur
type Place = {
  id: string;
  source: string[];
  target: string[];
};

type Transition = {
  id: string;
  name: string | null;
  gaurd: string | null;
  source: string[];
  target: string[];
  gate: Gateway | null;
};

type Arc = {
  id: string; // special id consist of "a_"+target+"_"+source
  source: string;
  target: string;
}


class DPN {
  places: Map<string, Place>;
  transitions: Map<string, Transition>;
  arcs: Map<string, Arc>;
  source: Map<string, Number>;
  sink: Map<string, Number>;

  constructor() {
    this.places = new Map<string, Place>();
    this.transitions = new Map<string, Transition>();
    this.arcs = new Map<string, Arc>();
    this.source = new Map<string, Number>();
    this.sink = new Map<string, Number>();

    this.createSorceAndSink();
  }

  private createSorceAndSink() {
    const sourceId = this.addPlace("source");
    const sinkId = this.addPlace("sink");

    this.source.set(sourceId,1);
    this.sink.set(sinkId,1);
  }

  addPlace(id: string): string {
    if (!this.places.has(id)) {
      this.places.set(id, {
        id: id,
        source: [],
        target: [],
      })
    }
    return id;
  }

  addTransition(id: string, name: string | null, gate: Gateway | null = null): string {
    if (!this.transitions.has(id)) {
      this.transitions.set(id, {
        id: id,
        name: name,
        gaurd: null,
        source: [],
        target: [],
        gate: gate
      })
    }
    return id;
  }

  addArc(sourceId: string, targetId: string): string {
    const id = sourceId + "_" + targetId;
    if (!this.arcs.has(id)) {
      this.arcs.set(id, {
        id: id,
        source: sourceId,
        target: targetId,
      })
    }
    return id;
  }

  addArcToStartTransition(startId: string) {
    const id = "source_" + startId;
    if (!this.arcs.has(id)) {
      this.arcs.set(id, {
        id: id,
        source: "source",
        target: startId
      });
    }
  }

  addArcToEndTransition(endId: string) {
    const id = endId + "_sink";
    if (!this.arcs.has(id)) {
      this.arcs.set(id, {
        id: id,
        source: endId,
        target: "sink"
      });
    }

  }
}


export {
  DPN
}