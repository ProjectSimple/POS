const Keys = {
  Lock: {
    // caps
    ID: 217,
    Name: "INPUT_FRONTEND_SELECT",
  },
  Marker: {
    // g
    ID: 47,
    Name: "INPUT_DETONATE",
  },
  Submit: {
    // enter
    ID: 191,
    Name: "INPUT_FRONTEND_RDOWN",
  },

  Up: {
    ID: 172,
    Name: "INPUT_CELLPHONE_UP",
  },
  Down: {
    ID: 173,
    Name: "INPUT_CELLPHONE_DOWN",
  },
  Left: {
    ID: 174,
    Name: "INPUT_CELLPHONE_LEFT",
  },
  Right: {
    ID: 175,
    Name: "INPUT_CELLPHONE_RIGHT",
  },
};

const Directions = {
  Up: [0, 0.25],
  Down: [0, -0.25],
  Left: [-0.25, 0],
  Right: [0.25, 0],
};

let notification = { text: "", showing: false };

const NotificationTick = () => {
  if (notification.showing) {
    SetTextComponentFormat("STRING");
    AddTextComponentString(notification.text);
    DisplayHelpTextFromStringLabel(0, 0, 1, -1);
  }
};

let nTick = setTick(NotificationTick);

const RangeToCheck = 50; // search range for suspect; 50 seems to work.
const PlayerPed = GetPlayerPed(-1);
let officers = [];

class Officer {
  static get Position() {
    return GetEntityCoords(PlayerPed);
  }

  static get Heading() {
    return GetEntityHeading(PlayerPed);
  }

  static get Vehicle() {
    return GetVehiclePedIsIn(PlayerPed);
  }

  static get SirensEngaged() {
    return IsVehicleSirenOn(this.Vehicle);
  }

  static get VehicleSeatMax() {
    return GetVehicleMaxNumberOfPassengers(this.Vehicle);
  }

  static get GroupID() {
    return GetPlayerGroup(PlayerPed);
  }

  static AddMissingOfficers() {
    [...Array(this.VehicleSeatMax).keys()].map((o) => {
      // Event to add officers to group
    });
  }
}

const MakePersistent = (ped, vehicle) => {
  SetEntityAsMissionEntity(ped);
  SetEntityAsMissionEntity(vehicle);
};

const RemovePersistence = (ped, vehicle) => {
  SetEntityAsNoLongerNeeded(ped);
  SetEntityAsNoLongerNeeded(vehicle);
};

onNet("POS:MakePersistent", MakePersistent);
onNet("POS:Unpersist", RemovePersistence);

class Suspect {
  constructor(vehicleHandle) {
    this.PlayerPed = GetPedInVehicleSeat(vehicleHandle, -1);
    this.Vehicle = vehicleHandle;
    this.stopping = false;

    this.Blip();

    notification.text = "Activate your ~r~lights~w~ to stop the vehicle!";
    notification.showing = true;
    if (!nTick) nTick = setTick(NotificationTick);

    //MakePersistent(this.PlayerPed, this.Vehicle);
    emitNet("POS:MakePersistent", this.PlayerPed, this.Vehicle);
    //SetPedAsGroupMember(this.PlayerPed, Officer.GroupID);
    this.FreezeWhenStopped();
  }

  CreateMarker() {
    return new Marker(
      this.Position,
      this.Vehicle,
      this.ParkFromStop.bind(this)
    );
  }

  static FindVehicle(SearchVehicle, Range) {
    const RayTest = StartShapeTestRay(
      ...GetEntityCoords(SearchVehicle),
      ...GetOffsetFromEntityInWorldCoords(SearchVehicle, 0, RangeToCheck, 0),
      2,
      SearchVehicle,
      0
    );
    const SuspectVehicle = GetShapeTestResult(RayTest)[4];
    if (SuspectVehicle == 0) return false;
    else return new Suspect(SuspectVehicle);
  }

  get Position() {
    return GetEntityCoords(this.Vehicle);
  }

  get Velocity() {
    return GetEntityVelocity(this.Vehicle);
  }

  get Heading() {
    return GetEntityHeading(this.Vehicle);
  }

  get NearPark() {
    let [sx, sy, sz] = this.Position;
    let [cx, cy, cz] = this.parkPosition;
    let [dx, dy, dz] = [cx - sx, cy - sy, cz - sz].map((v) => Math.abs(v));
    let [ddx, ddy, ddz] = [sx - cx, sy - cy, sz - cz].map((v) => Math.abs(v));

    if (dx + dy < 5) {
      this.parkPosition = false;
      this.stopped = true;
      return true;
    } else return false;
  }

  Clear() {
    ClearPedTasks(this.PlayerPed);
    ClearPedSecondaryTask(this.PlayerPed);
  }

  Pause() {
    //TaskPause(this.PlayerPed, 69 * 69 * 69 * 69 * 69 * 69);
    //this.Clear();
    //this.EngineOff();
  }

  FreezeWhenStopped() {
    this.freezeTick = setTick(() => {
      if (!this.parkPosition) return;
      if (this.NearPark) {
        this.Pause();
      }
    });
  }

  Park(position, radius) {
    this.parkPosition = position;
    TaskVehiclePark(
      this.PlayerPed,
      this.Vehicle,
      ...position,
      Officer.Heading,
      0,
      radius,
      false
    );
  }

  ParkFromStop(position, radius) {
    this.Clear();
    //this.EngineOnManual();
    this.Park(position, radius);
  }

  Blip() {
    this.blip = AddBlipForEntity(this.Vehicle);
  }

  UnBlip() {
    RemoveBlip(this.blip);
    this.blip = false;
  }

  Stop() {
    let [sx, sy, sz] = this.Position;
    let [vx, vy] = this.Velocity;
    this.stopping = true;
    this.Park([sx + vx * 2, sy + vy * 2, sz], Math.abs(vx) + Math.abs(vy));
  }

  EngineOnManual() {
    SetVehicleEngineOn(this.Vehicle, true, false, false);
  }

  EngineOff() {
    SetVehicleEngineOn(this.Vehicle, false, true, false);
  }

  MoveForward() {
    let [ox, oy] = GetOffsetFromEntityInWorldCoords(
      this.Vehicle,
      ...Directions.Up,
      0
    );
    let [sx, sy, sz] = this.Position;
    TaskVehicleDriveToCoord(
      this.PlayerPed,
      this.Vehicle,
      sx + ox,
      sy + oy,
      sz,
      10,
      0,
      GetHashKey(this.Vehicle),
      1074528293,
      200
    );
  }

  Unlock() {
    clearTick(this.freezeTick);
    this.UnBlip();
    this.Clear();
    emitNet("POS:Unpersist", this.PlayerPed, this.Vehicle);
    //RemovePersistence(this.PlayerPed, this.Vehicle);
    notification.showing = false;
    clearTick(nTick);
    nTick = false;
    if (this.stopped) {
      this.EngineOnManual();
      this.MoveForward();
    }
    return false;
  }
}

class Marker {
  constructor(coords, handle, cb) {
    this.handle = handle;
    this.cb = cb;

    this.Setup(coords);
    this.showing = true;

    this.renderTick = setTick(() => {
      if (!this.showing) {
        notification.text = "";
        notification.showing = false;
        return;
      }
      this.Render();
      notification.text = `~${Keys.Marker.Name}~ toggle marker\narrow keys or dpad to move\n~${Keys.Submit.Name}~ move suspect`;
      notification.showing = true;
    });

    this.controlsTick = setTick(() => {
      if (
        IsControlPressed(0, Keys.Up.ID) ||
        IsDisabledControlPressed(0, Keys.Up.ID)
      )
        this.Move(Directions.Up);
      if (IsControlPressed(0, Keys.Down.ID)) this.Move(Directions.Down);
      if (IsControlPressed(0, Keys.Left.ID)) this.Move(Directions.Left);
      if (IsControlPressed(0, Keys.Right.ID)) this.Move(Directions.Right);
      if (IsControlJustReleased(0, Keys.Submit.ID)) this.Submit();
    });
  }

  get handleCoords() {
    return GetEntityCoords(this.handle);
  }

  Submit() {
    this.cb([this.x, this.y, this.z], 5);
  }

  Setup(coords) {
    if (!coords) coords = this.handleCoords;
    [this.x, this.y, this.z] = coords;
  }

  Move(dir) {
    let [ox, oy] = GetOffsetFromEntityInWorldCoords(this.handle, ...dir, 0);
    let [sx, sy, sz] = this.handleCoords;
    this.x = this.x + (ox - sx);
    this.y = this.y + (oy - sy);
    this.z = sz;
  }

  Render() {
    DrawMarker(
      2,
      this.x,
      this.y,
      GetGroundZFor_3dCoord(this.x, this.y, this.z + 2, 0)[1] + 2,
      0,
      0,
      0,
      0,
      180,
      0,
      2,
      2,
      2,
      235,
      222,
      52,
      100,
      true,
      true,
      2,
      false,
      null,
      null,
      false
    );
  }

  Clear() {
    clearTick(this.renderTick);
    clearTick(this.controlsTick);
    return false;
  }
}

let currentSuspect = false;
let marker = false;

setTick(() => {
  if (IsControlJustReleased(0, Keys.Lock.ID))
    if (currentSuspect) {
      currentSuspect = currentSuspect.Unlock();
      if (marker) marker = marker.Clear();
    } else currentSuspect = Suspect.FindVehicle(Officer.Vehicle, RangeToCheck);

  if (IsControlJustReleased(0, Keys.Marker.ID))
    if (marker) marker = marker.Clear();
    else marker = currentSuspect.CreateMarker();

  if (currentSuspect && !currentSuspect.stopping) {
    if (Officer.SirensEngaged) currentSuspect.Stop();
  }

  if (Officer.Vehicle) Officer.AddMissingOfficers();

  if (currentSuspect && (!marker || !marker.showing)) {
    notification.text = `~${Keys.Lock.Name}~ release\n~${Keys.Marker.Name}~ to use marker`;
    notification.showing = true;
  }
});
